// Analytics, ledger explorer, verification log, audit trail, notifications,
// users and roles, settings, system health, exports and global search.
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../lib/auth');
const { visibleWhere } = require('../lib/access');
const { isOfficial, computeFlags } = require('../lib/records');
const { findOverlaps } = require('../lib/geo');
const { verifyLedger, UPLOAD_DIR } = require('../lib/seal');
const ai = require('../lib/ai');
const audit = require('../lib/audit');

router.use(requireAuth);
const officials = requireRole('lc_official', 'mediator', 'admin');

// ---------------------------------------------------------------- analytics
router.get('/analytics/overview', async (req, res) => {
  const p = [];
  const vis = visibleWhere(req.user, p);
  const one = async (sql, params = p) => (await query(sql, params)).rows[0];
  const many = async (sql, params = p) => (await query(sql, params)).rows;

  const totals = await one(`
    SELECT count(*)::int AS records,
      count(*) FILTER (WHERE status = 'sealed')::int AS sealed,
      count(*) FILTER (WHERE status = 'draft')::int AS drafts,
      COALESCE(sum(area_m2) FILTER (WHERE status = 'sealed'), 0)::float AS sealed_area_m2,
      COALESCE(sum(area_m2), 0)::float AS area_m2,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM parties x WHERE x.record_id = r.id AND x.gender = 'female'))::int AS with_women,
      count(*) FILTER (WHERE family_land AND record_type IN ('sale','gift'))::int AS family_transfers,
      count(*) FILTER (WHERE family_land AND record_type IN ('sale','gift') AND spouse_consent)::int AS family_transfers_consented,
      count(*) FILTER (WHERE family_land AND record_type IN ('sale','gift') AND NOT spouse_consent)::int AS consent_flags,
      count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS new_30d,
      count(*) FILTER (WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days')::int AS new_prev_30d,
      count(DISTINCT district)::int AS districts
    FROM records r WHERE ${vis}`);

  const monthly = await many(`
    WITH months AS (SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS m)
    SELECT to_char(m, 'Mon YY') AS label,
      (SELECT count(*) FROM records r WHERE ${vis} AND date_trunc('month', r.created_at) = m)::int AS created,
      (SELECT count(*) FROM records r WHERE ${vis} AND date_trunc('month', r.sealed_at) = m)::int AS sealed,
      (SELECT COALESCE(sum(area_m2), 0) / 4046.86 FROM records r WHERE ${vis} AND date_trunc('month', r.sealed_at) = m)::float AS acres
    FROM months ORDER BY m`);

  const byType = await many(`SELECT record_type AS id, count(*)::int AS value FROM records r WHERE ${vis} GROUP BY 1 ORDER BY 2 DESC`);
  const byTenure = await many(`SELECT tenure AS id, count(*)::int AS value FROM records r WHERE ${vis} GROUP BY 1 ORDER BY 2 DESC`);
  const byDistrict = await many(`
    SELECT district AS id, count(*)::int AS records, count(*) FILTER (WHERE status = 'sealed')::int AS sealed,
      round(COALESCE(sum(area_m2), 0) / 4046.86, 1)::float AS acres,
      (SELECT count(*) FROM disputes d JOIN records r2 ON r2.id = d.record_id WHERE r2.district = r.district AND d.stage <> 'resolved')::int AS open_disputes
    FROM records r WHERE ${vis} AND district IS NOT NULL GROUP BY district ORDER BY 2 DESC`);
  const gender = await many(`
    SELECT COALESCE(x.gender, 'unknown') AS id, count(*)::int AS value
    FROM parties x JOIN records r ON r.id = x.record_id WHERE ${vis} GROUP BY 1`);

  const disputes = await one(`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE d.stage <> 'resolved')::int AS open,
      count(*) FILTER (WHERE d.stage = 'resolved')::int AS resolved,
      count(*) FILTER (WHERE d.stage = 'mediation')::int AS in_mediation,
      COALESCE(avg(EXTRACT(EPOCH FROM (d.resolved_at - d.created_at)) / 86400) FILTER (WHERE d.stage = 'resolved'), 0)::float AS avg_days_to_resolve,
      count(*) FILTER (WHERE d.session_at > now() AND d.stage <> 'resolved')::int AS upcoming_sessions
    FROM disputes d JOIN records r ON r.id = d.record_id WHERE ${vis}`);
  const disputeStages = await many(`SELECT d.stage AS id, count(*)::int AS value FROM disputes d JOIN records r ON r.id = d.record_id WHERE ${vis} GROUP BY 1`);
  const disputeCategories = await many(`SELECT d.category AS id, count(*)::int AS value FROM disputes d JOIN records r ON r.id = d.record_id WHERE ${vis} GROUP BY 1 ORDER BY 2 DESC`);

  const verifications = await many(`
    WITH days AS (SELECT generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d)
    SELECT to_char(d, 'DD Mon') AS label,
      (SELECT count(*) FROM verifications v LEFT JOIN records r ON r.id = v.record_id WHERE date_trunc('day', v.created_at) = d AND (v.record_id IS NULL OR ${vis}) AND v.valid IS TRUE)::int AS authentic,
      (SELECT count(*) FROM verifications v LEFT JOIN records r ON r.id = v.record_id WHERE date_trunc('day', v.created_at) = d AND (v.record_id IS NULL OR ${vis}) AND (v.valid IS NOT TRUE))::int AS failed
    FROM days ORDER BY d`);
  const verifTotals = await one(`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE v.verifier_type = 'lender')::int AS lenders,
      count(*) FILTER (WHERE v.valid IS NOT TRUE)::int AS failed,
      count(*) FILTER (WHERE v.created_at > now() - interval '7 days')::int AS last_7d
    FROM verifications v LEFT JOIN records r ON r.id = v.record_id WHERE (v.record_id IS NULL AND ${isOfficial(req.user) ? 'TRUE' : 'FALSE'}) OR (v.record_id IS NOT NULL AND ${vis})`);
  const verifierTypes = await many(`SELECT v.verifier_type AS id, count(*)::int AS value FROM verifications v LEFT JOIN records r ON r.id = v.record_id WHERE v.record_id IS NOT NULL AND ${vis} GROUP BY 1 ORDER BY 2 DESC`);

  const ledger = await one('SELECT count(*)::int AS length, max(sealed_at) AS last_sealed FROM seals', []);
  const t = totals;
  const sdg = [
    { sdg: 1, indicator: '1.4.2', label: 'Households with documented land rights', value: t.sealed, unit: 'records' },
    { sdg: 5, indicator: '5.a.1', label: 'Records naming a woman as owner or party', value: t.records ? Math.round((t.with_women / t.records) * 100) : 0, unit: '%' },
    { sdg: 16, indicator: '16.3', label: 'Disputes resolved through mediation', value: disputes.resolved, unit: 'disputes' },
    { sdg: 16, indicator: '16.6', label: 'Family-land transfers with spousal consent', value: t.family_transfers ? Math.round((t.family_transfers_consented / t.family_transfers) * 100) : 100, unit: '%' },
    { sdg: 2, indicator: '2.3', label: 'Acres of farmland secured', value: Math.round(t.sealed_area_m2 / 4046.86), unit: 'acres' },
    { sdg: 8, indicator: '8.10', label: 'Lender verifications supporting credit', value: verifTotals.lenders, unit: 'checks' },
  ];
  res.json({ totals, monthly, byType, byTenure, byDistrict, gender, disputes, disputeStages, disputeCategories, verifications, verifTotals, verifierTypes, ledger, sdg });
});

// All plots for the land map, with overlap detection.
router.get('/analytics/map', async (req, res) => {
  const p = [];
  const { rows } = await query(`
    SELECT r.id, r.code, r.title, r.record_type, r.status, r.tenure, r.district, r.village, r.area_m2, r.boundary, r.family_land, r.spouse_consent,
      (SELECT string_agg(full_name, ', ' ORDER BY id) FROM parties x WHERE x.record_id = r.id) AS party_names,
      (SELECT count(*) FROM disputes d WHERE d.record_id = r.id AND d.stage <> 'resolved')::int AS open_disputes
    FROM records r WHERE ${visibleWhere(req.user, p)} AND jsonb_array_length(r.boundary) >= 3`, p);
  const pairs = findOverlaps(rows).map((o) => ({
    a: { id: o.a.id, code: o.a.code, title: o.a.title, record_type: o.a.record_type },
    b: { id: o.b.id, code: o.b.code, title: o.b.title, record_type: o.b.record_type },
    area_m2: o.area_m2, pct_of_smaller: o.pct_of_smaller,
  }));
  const conflicted = new Set(pairs.flatMap((x) => [x.a.id, x.b.id]));
  res.json({ plots: rows.map((r) => ({ ...r, overlap: conflicted.has(r.id) })), overlaps: pairs });
});

// ---------------------------------------------------------------- ledger
router.get('/ledger', async (req, res) => {
  const pageSize = Math.min(100, Number(req.query.pageSize) || 15);
  const page = Math.max(1, Number(req.query.page) || 1);
  const { rows: [{ total }] } = await query('SELECT count(*)::int AS total FROM seals');
  const { rows } = await query(`
    SELECT s.id AS position, s.seal_hash, s.prev_hash, s.sealed_at, r.id AS record_id, r.code, r.title, r.district, r.record_type, u.full_name AS sealed_by,
      length(s.payload::text) AS payload_bytes
    FROM seals s JOIN records r ON r.id = s.record_id LEFT JOIN users u ON u.id = s.sealed_by
    ORDER BY s.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
  res.json({ blocks: rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) });
});

router.get('/ledger/verify', async (req, res) => {
  const result = await verifyLedger({ query });
  await audit.log(null, { actor: { id: req.user.id, name: req.user.name }, action: 'ledger.verified', summary: `Full ledger check: ${result.valid ? 'all entries valid' : `problem found at entry #${result.first_problem}`} (${result.length} entries)` });
  res.json(result);
});

router.get('/ledger/:position', async (req, res) => {
  const { rows: [s] } = await query(`SELECT s.*, r.code, r.title, u.full_name AS sealed_by_name FROM seals s JOIN records r ON r.id = s.record_id
    LEFT JOIN users u ON u.id = s.sealed_by WHERE s.id = $1`, [req.params.position]);
  if (!s) return res.status(404).json({ error: 'Ledger entry not found' });
  res.json({ block: s });
});

// ---------------------------------------------------------------- verification log
router.get('/verifications', officials, async (req, res) => {
  const pageSize = Math.min(100, Number(req.query.pageSize) || 12);
  const page = Math.max(1, Number(req.query.page) || 1);
  const where = []; const params = [];
  if (req.query.result === 'failed') where.push('v.valid IS NOT TRUE');
  if (req.query.result === 'authentic') where.push('v.valid IS TRUE');
  if (req.query.type) { params.push(req.query.type); where.push(`v.verifier_type = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows: [{ total }] } = await query(`SELECT count(*)::int AS total FROM verifications v ${w}`, params);
  const { rows } = await query(`SELECT v.*, r.title, r.district FROM verifications v LEFT JOIN records r ON r.id = v.record_id ${w}
    ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params);
  res.json({ verifications: rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
});

// ---------------------------------------------------------------- activity
router.get('/activity', async (req, res) => {
  const pageSize = Math.min(100, Number(req.query.pageSize) || 15);
  const page = Math.max(1, Number(req.query.page) || 1);
  const params = [];
  const where = isOfficial(req.user) ? 'TRUE' : `(a.actor_id = ${Number(req.user.id)} OR (a.record_id IS NOT NULL AND ${visibleWhere(req.user, params)}))`;
  const from = 'FROM activity a LEFT JOIN records r ON r.id = a.record_id';
  let filter = '';
  if (req.query.action) { params.push(`${req.query.action}%`); filter = ` AND a.action LIKE $${params.length}`; }
  if (req.query.exclude) { params.push(`${req.query.exclude}%`); filter += ` AND a.action NOT LIKE $${params.length}`; }
  const { rows: [{ total }] } = await query(`SELECT count(*)::int AS total ${from} WHERE ${where}${filter}`, params);
  const { rows } = await query(`SELECT a.*, r.code, r.title, CASE WHEN au.photo IS NOT NULL THEN '/uploads/' || au.photo END AS actor_photo ${from} LEFT JOIN users au ON au.id = a.actor_id WHERE ${where}${filter} ORDER BY a.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params);
  res.json({ activity: rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
});

// ---------------------------------------------------------------- notifications
router.get('/notifications', async (req, res) => {
  const { rows } = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30', [req.user.id]);
  const { rows: [{ unread }] } = await query('SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ notifications: rows, unread });
});
router.post('/notifications/read-all', async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
});
router.post('/notifications/:id/read', async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- users and roles
router.get('/users', officials, async (req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.full_name, u.phone, u.role, u.title, u.district, u.active, u.last_login_at, u.created_at, CASE WHEN u.photo IS NOT NULL THEN '/uploads/' || u.photo END AS photo_url,
      (SELECT count(*) FROM records r WHERE r.created_by = u.id)::int AS records
    FROM users u ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'lc_official' THEN 1 WHEN 'mediator' THEN 2 ELSE 3 END, u.full_name`);
  res.json({ users: rows });
});
router.patch('/users/:id', requireRole('admin'), async (req, res) => {
  const { role, active } = req.body;
  if (Number(req.params.id) === req.user.id && (role && role !== 'admin' || active === false)) {
    return res.status(400).json({ error: 'You cannot remove your own administrator access.' });
  }
  if (role && !['citizen', 'lc_official', 'mediator', 'admin'].includes(role)) return res.status(400).json({ error: 'Unknown role' });
  const { rows: [u] } = await query(`UPDATE users SET role = COALESCE($2, role), active = COALESCE($3, active) WHERE id = $1
    RETURNING id, full_name, role, active`, [req.params.id, role || null, typeof active === 'boolean' ? active : null]);
  if (!u) return res.status(404).json({ error: 'User not found' });
  await audit.log(null, { actor: { id: req.user.id, name: req.user.name }, action: 'user.updated', summary: `Updated ${u.full_name}: role ${u.role}, ${u.active ? 'active' : 'deactivated'}` });
  res.json({ user: u });
});

// ---------------------------------------------------------------- settings
const DEFAULT_SETTINGS = {
  organisation: { name: 'Ettaka Uganda', deployment: 'Wakiso and Mukono pilot', contact_email: 'pilot@ettaka.ug', timezone: 'Africa/Kampala' },
  policy: { require_lc1_witness: true, min_witnesses: 2, block_family_land_without_consent: true, overlap_threshold_pct: 2 },
  security: { pin_min_length: 4, session_days: 7, audit_logging: true, mask_phones_on_portal: true },
  notifications: { sms: false, email: true, notify_on_verification: true, notify_on_overlap: true },
};
async function getSettings() {
  const { rows } = await query('SELECT key, value FROM settings');
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const r of rows) out[r.key] = { ...(out[r.key] || {}), ...r.value };
  out.system = { demo_mode: process.env.DEMO_MODE !== 'false' };
  return out;
}
router.get('/settings', async (req, res) => res.json({ settings: await getSettings() }));
router.put('/settings', requireRole('admin'), async (req, res) => {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (req.body[key] && typeof req.body[key] === 'object') {
      await query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`, [key, JSON.stringify(req.body[key])]);
    }
  }
  await audit.log(null, { actor: { id: req.user.id, name: req.user.name }, action: 'settings.updated', summary: `Updated settings: ${Object.keys(req.body).join(', ')}` });
  res.json({ settings: await getSettings() });
});

// ---------------------------------------------------------------- system health
router.get('/system/health', async (req, res) => {
  const t0 = Date.now();
  const { rows: [db] } = await query("SELECT version(), pg_database_size(current_database()) AS size, now() AS now");
  const dbMs = Date.now() - t0;
  const ledger = await verifyLedger({ query });
  let files = 0, bytes = 0;
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    if (f.startsWith('.')) continue;
    files++; bytes += fs.statSync(path.join(UPLOAD_DIR, f)).size;
  }
  const { rows: [counts] } = await query(`SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM records)::int AS records,
    (SELECT count(*) FROM activity)::int AS activity, (SELECT max(created_at) FROM activity) AS last_activity`);
  res.json({
    services: [
      { id: 'api', label: 'API server', ok: true, detail: `Node ${process.version} · up ${Math.round(process.uptime() / 60)} min` },
      { id: 'db', label: 'PostgreSQL database', ok: true, detail: `${db.version.split(' ').slice(0, 2).join(' ')} · ${dbMs} ms · ${(db.size / 1048576).toFixed(1)} MB` },
      { id: 'ledger', label: 'Seal ledger', ok: ledger.valid, detail: ledger.valid ? `${ledger.length} entries, chain intact` : `Problem at entry #${ledger.first_problem}` },
      { id: 'storage', label: 'Evidence storage', ok: true, detail: `${files} files · ${(bytes / 1048576).toFixed(2)} MB` },
      { id: 'gemini', label: 'Google Gemini', ok: ai.enabled(), detail: ai.enabled() ? `Model ${ai.MODEL}` : 'Not configured: using built-in fallbacks' },
    ],
    counts,
    ledger_head: ledger.head,
  });
});

// Reset the demonstration dataset (admin only, demo mode only).
router.post('/system/reset-demo', requireRole('admin'), async (req, res) => {
  if (process.env.DEMO_MODE === 'false') return res.status(404).end();
  const { execFile } = require('child_process');
  execFile(process.execPath, [path.join(__dirname, '..', 'seed.js')], { cwd: path.join(__dirname, '..', '..'), timeout: 120000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Reset failed' });
    res.json({ ok: true, output: stdout.split('\n')[0] });
  });
});

// ---------------------------------------------------------------- CSV exports
const csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => {
  const v = r[c] === null || r[c] === undefined ? '' : r[c] instanceof Date ? r[c].toISOString() : typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c]);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}).join(','))].join('\n');

router.get('/reports/:dataset.csv', async (req, res) => {
  const p = [];
  const vis = visibleWhere(req.user, p);
  const sets = {
    records: [`SELECT r.code, r.title, r.record_type, r.status, r.tenure, r.district, r.subcounty, r.village, round(r.area_m2 / 4046.86, 3) AS acres,
      r.price_ugx, r.family_land, r.spouse_consent, r.created_at, r.sealed_at,
      (SELECT string_agg(full_name || ' (' || role || ')', '; ') FROM parties x WHERE x.record_id = r.id) AS parties
      FROM records r WHERE ${vis} ORDER BY r.created_at`, ['code', 'title', 'record_type', 'status', 'tenure', 'district', 'subcounty', 'village', 'acres', 'price_ugx', 'family_land', 'spouse_consent', 'created_at', 'sealed_at', 'parties']],
    disputes: [`SELECT r.code, d.title, d.category, d.stage, d.priority, d.complainant, d.respondent, d.referred_to, d.session_at, d.outcome, d.created_at, d.resolved_at
      FROM disputes d JOIN records r ON r.id = d.record_id WHERE ${vis} ORDER BY d.created_at`, ['code', 'title', 'category', 'stage', 'priority', 'complainant', 'respondent', 'referred_to', 'session_at', 'outcome', 'created_at', 'resolved_at']],
    ledger: [`SELECT s.id AS position, r.code, s.seal_hash, s.prev_hash, s.sealed_at FROM seals s JOIN records r ON r.id = s.record_id WHERE ${vis} ORDER BY s.id`, ['position', 'code', 'seal_hash', 'prev_hash', 'sealed_at']],
    verifications: [`SELECT v.created_at, v.code, v.found, v.valid, v.verifier_type FROM verifications v LEFT JOIN records r ON r.id = v.record_id
      WHERE v.record_id IS NULL OR ${vis} ORDER BY v.created_at DESC`, ['created_at', 'code', 'found', 'valid', 'verifier_type']],
  };
  const set = sets[req.params.dataset];
  if (!set) return res.status(404).json({ error: 'Unknown dataset' });
  const { rows } = await query(set[0], p);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ettaka-${req.params.dataset}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv(rows, set[1]));
});

// ---------------------------------------------------------------- global search
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ records: [], disputes: [], people: [] });
  const p = [`%${q}%`];
  const vis = visibleWhere(req.user, p);
  const records = (await query(`SELECT r.id, r.code, r.title, r.status, r.district, r.village FROM records r
    WHERE ${vis} AND (lower(r.title) LIKE $1 OR lower(r.code) LIKE $1 OR lower(coalesce(r.village,'')) LIKE $1 OR lower(coalesce(r.district,'')) LIKE $1)
    ORDER BY r.updated_at DESC LIMIT 6`, p)).rows;
  const people = (await query(`SELECT DISTINCT ON (x.full_name) x.full_name, x.role, r.id AS record_id, r.code FROM parties x JOIN records r ON r.id = x.record_id
    WHERE ${vis} AND lower(x.full_name) LIKE $1 ORDER BY x.full_name LIMIT 5`, p)).rows;
  const disputes = (await query(`SELECT d.id, d.title, d.stage, r.code FROM disputes d JOIN records r ON r.id = d.record_id
    WHERE ${vis} AND (lower(d.title) LIKE $1 OR lower(coalesce(d.complainant,'')) LIKE $1) LIMIT 4`, p)).rows;
  res.json({ records, people, disputes });
});

module.exports = router;
module.exports.computeFlags = computeFlags;
