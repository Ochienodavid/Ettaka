const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const QRCode = require('qrcode');
const { query, tx } = require('../db');
const { requireAuth } = require('../lib/auth');
const { polygonAreaM2, isValidBoundary } = require('../lib/geo');
const { UPLOAD_DIR, sha256, sealRecord, verifyRecord } = require('../lib/seal');
const { newCode, computeFlags, sealBlockers, isOfficial } = require('../lib/records');
const { visibleWhere, loadVisible, overlapsFor } = require('../lib/access');
const audit = require('../lib/audit');
const ai = require('../lib/ai');

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname || '').toLowerCase().slice(0, 6)),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image|audio)\//.test(file.mimetype) || file.mimetype === 'application/pdf'),
});

router.use(requireAuth);

const FIELDS = ['record_type', 'title', 'district', 'subcounty', 'village', 'tenure', 'plot_description', 'price_ugx',
  'payment_terms', 'terms_transcript', 'agreement_en', 'agreement_lg', 'family_land', 'spouse_name', 'spouse_consent', 'boundary'];
const actor = (req) => ({ id: req.user.id, name: req.user.name });

async function fullRecord(r) {
  const [parties, witnesses, evidence, disputes, activity, verifs, creator] = await Promise.all([
    query(`SELECT p.*, '/uploads/' || e.filename AS photo_url FROM parties p LEFT JOIN evidence e ON e.id = p.photo_evidence_id WHERE p.record_id = $1 ORDER BY p.id`, [r.id]),
    query(`SELECT w.*, '/uploads/' || e.filename AS photo_url FROM witnesses w LEFT JOIN evidence e ON e.id = w.photo_evidence_id WHERE w.record_id = $1 ORDER BY w.id`, [r.id]),
    query('SELECT * FROM evidence WHERE record_id = $1 ORDER BY id', [r.id]),
    query(`SELECT d.*, u.full_name AS mediator_name FROM disputes d LEFT JOIN users u ON u.id = d.mediator_id
           WHERE d.record_id = $1 ORDER BY d.created_at DESC`, [r.id]),
    query('SELECT * FROM activity WHERE record_id = $1 ORDER BY created_at DESC LIMIT 50', [r.id]),
    query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE verifier_type = 'lender')::int AS lenders,
           max(created_at) AS last FROM verifications WHERE record_id = $1`, [r.id]),
    query('SELECT full_name, photo FROM users WHERE id = $1', [r.created_by]),
  ]);
  const overlaps = await overlapsFor(r);
  const verification = r.status === 'sealed' ? await verifyRecord({ query }, r.id) : null;
  return {
    ...r,
    created_by_name: creator.rows[0]?.full_name || null,
    parties: parties.rows,
    witnesses: witnesses.rows,
    evidence: evidence.rows.map((e) => ({ ...e, url: `/uploads/${e.filename}` })),
    disputes: disputes.rows,
    activity: activity.rows,
    verifications: verifs.rows[0],
    overlaps,
    flags: computeFlags(r, parties.rows, witnesses.rows, overlaps),
    blockers: r.status === 'draft' ? sealBlockers(r, parties.rows, witnesses.rows) : [],
    verification,
  };
}

function cleanBody(body) {
  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (out.price_ugx === '' || out.price_ugx === null) out.price_ugx = null;
  else if (out.price_ugx !== undefined) out.price_ugx = Math.round(Number(String(out.price_ugx).replace(/[^\d.]/g, ''))) || null;
  if (out.boundary !== undefined) {
    if (!isValidBoundary(out.boundary)) throw Object.assign(new Error('Boundary points are not valid coordinates'), { status: 400 });
    out.area_m2 = out.boundary.length >= 3 ? polygonAreaM2(out.boundary).toFixed(2) : null;
    out.boundary = JSON.stringify(out.boundary);
  }
  return out;
}

// Only accept an identity photo that belongs to this record.
async function ownEvidence(client, recordId, id) {
  if (!id) return null;
  const { rows } = await client.query("SELECT id FROM evidence WHERE id = $1 AND record_id = $2 AND kind = 'identity_photo'", [Number(id), recordId]);
  return rows[0]?.id || null;
}

async function replaceChildren(client, recordId, parties, witnesses) {
  if (Array.isArray(parties)) {
    await client.query('DELETE FROM parties WHERE record_id = $1', [recordId]);
    for (const p of parties.filter((x) => x && x.full_name && x.role)) {
      await client.query('INSERT INTO parties (record_id, role, full_name, phone, gender, photo_evidence_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [recordId, p.role, p.full_name.trim(), p.phone || null, p.gender || null, await ownEvidence(client, recordId, p.photo_evidence_id)]);
    }
  }
  if (Array.isArray(witnesses)) {
    await client.query('DELETE FROM witnesses WHERE record_id = $1', [recordId]);
    for (const w of witnesses.filter((x) => x && x.full_name)) {
      await client.query('INSERT INTO witnesses (record_id, full_name, title, phone, statement, photo_evidence_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [recordId, w.full_name.trim(), w.title || null, w.phone || null, w.statement || null, await ownEvidence(client, recordId, w.photo_evidence_id)]);
    }
  }
}

// List with search, filters and pagination
router.get('/', async (req, res) => {
  const params = [];
  const where = [visibleWhere(req.user, params)];
  const { q, status, type, district, tenure, flag } = req.query;
  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    where.push(`(lower(r.title) LIKE $${params.length} OR lower(r.code) LIKE $${params.length} OR lower(coalesce(r.village,'')) LIKE $${params.length}
      OR EXISTS (SELECT 1 FROM parties pq WHERE pq.record_id = r.id AND lower(pq.full_name) LIKE $${params.length}))`);
  }
  if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
  if (type) { params.push(type); where.push(`r.record_type = $${params.length}`); }
  if (district) { params.push(district); where.push(`r.district = $${params.length}`); }
  if (tenure) { params.push(tenure); where.push(`r.tenure = $${params.length}`); }
  if (flag === 'consent') where.push("r.family_land AND NOT r.spouse_consent AND r.record_type IN ('sale','gift')");
  if (flag === 'dispute') where.push("EXISTS (SELECT 1 FROM disputes dq WHERE dq.record_id = r.id AND dq.stage NOT IN ('resolved'))");
  const sorts = { recent: 'r.updated_at DESC', oldest: 'r.created_at ASC', area: 'r.area_m2 DESC NULLS LAST', title: 'r.title ASC' };
  const sort = sorts[req.query.sort] || sorts.recent;
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
  const page = Math.max(1, Number(req.query.page) || 1);

  const whereSql = where.join(' AND ');
  const { rows: [{ total }] } = await query(`SELECT count(*)::int AS total FROM records r WHERE ${whereSql}`, params);
  const { rows } = await query(`
    SELECT r.id, r.code, r.title, r.record_type, r.status, r.tenure, r.district, r.subcounty, r.village, r.area_m2, r.price_ugx,
           r.created_at, r.updated_at, r.sealed_at, r.family_land, r.spouse_consent, r.boundary,
           (SELECT json_agg(json_build_object('name', p.full_name, 'role', p.role, 'gender', p.gender, 'photo', '/uploads/' || ev.filename) ORDER BY p.id) FROM parties p LEFT JOIN evidence ev ON ev.id = p.photo_evidence_id WHERE p.record_id = r.id) AS parties,
           (SELECT count(*) FROM disputes d WHERE d.record_id = r.id AND d.stage <> 'resolved')::int AS open_disputes,
           (SELECT count(*) FROM evidence e WHERE e.record_id = r.id)::int AS evidence_count
    FROM records r WHERE ${whereSql} ORDER BY ${sort} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params);

  const facetParams = [];
  const { rows: districts } = await query(
    `SELECT r.district, count(*)::int AS n FROM records r WHERE ${visibleWhere(req.user, facetParams)} AND r.district IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`, facetParams);
  res.json({ records: rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), facets: { districts } });
});

// Create draft
router.post('/', async (req, res) => {
  const data = cleanBody(req.body);
  if (!data.record_type || !data.title) return res.status(400).json({ error: 'Choose a record type and give the record a title' });
  const id = await tx(async (client) => {
    const cols = Object.keys(data);
    const { rows: [r] } = await client.query(
      `INSERT INTO records (code, created_by, ${cols.join(', ')}) VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING id, code`,
      [newCode(), req.user.id, ...cols.map((c) => data[c])]);
    await replaceChildren(client, r.id, req.body.parties, req.body.witnesses);
    await audit.log(client, { actor: actor(req), action: 'record.created', recordId: r.id, summary: `Created draft record ${r.code}: ${data.title}` });
    return r.id;
  });
  res.status(201).json({ record: await fullRecord(await loadVisible(id, req.user)) });
});

router.get('/:id', async (req, res) => {
  const r = await loadVisible(req.params.id, req.user);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  res.json({ record: await fullRecord(r) });
});

// Update draft
router.put('/:id', async (req, res) => {
  const r = await loadVisible(req.params.id, req.user);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  if (r.status === 'sealed') return res.status(409).json({ error: 'This record is sealed and can no longer be changed.' });
  const data = cleanBody(req.body);
  await tx(async (client) => {
    const cols = Object.keys(data);
    if (cols.length) {
      await client.query(`UPDATE records SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
        [r.id, ...cols.map((c) => data[c])]);
    }
    await replaceChildren(client, r.id, req.body.parties, req.body.witnesses);
  });
  res.json({ record: await fullRecord(await loadVisible(r.id, req.user)) });
});

router.delete('/:id', async (req, res) => {
  const r = await loadVisible(req.params.id, req.user);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  if (r.status === 'sealed') return res.status(409).json({ error: 'Sealed records cannot be deleted.' });
  await query('DELETE FROM records WHERE id = $1', [r.id]);
  await audit.log(null, { actor: actor(req), action: 'record.deleted', summary: `Deleted draft ${r.code}: ${r.title}` });
  res.json({ ok: true });
});

// Evidence upload (photos of boundary marks, old documents, audio)
router.post('/:id/evidence', upload.single('file'), async (req, res) => {
  const r = await loadVisible(req.params.id, req.user);
  const discard = () => req.file && fs.rmSync(req.file.path, { force: true });
  if (!r) { discard(); return res.status(404).json({ error: 'Record not found' }); }
  if (!req.file) return res.status(400).json({ error: 'Attach an image, audio or PDF file' });
  if (r.status === 'sealed') { discard(); return res.status(409).json({ error: 'This record is sealed.' }); }
  const kind = ['boundary_photo', 'old_document', 'audio', 'signature', 'identity_photo', 'other'].includes(req.body.kind) ? req.body.kind : 'other';
  if (kind === 'identity_photo' && !/^image\//.test(req.file.mimetype)) { discard(); return res.status(400).json({ error: 'Identity photos must be images' }); }
  const num = (v) => (v === undefined || v === '' ? null : Number(v));
  const { rows: [e] } = await query(
    `INSERT INTO evidence (record_id, kind, filename, original_name, mime, size_bytes, sha256, caption, lat, lng)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [r.id, kind, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size,
      sha256(fs.readFileSync(req.file.path)), req.body.caption || null, num(req.body.lat), num(req.body.lng)]);
  await query('UPDATE records SET updated_at = now() WHERE id = $1', [r.id]);
  await audit.log(null, { actor: actor(req), action: 'evidence.added', recordId: r.id, summary: `Added ${kind.replace('_', ' ')}${e.caption ? `: ${e.caption}` : ''}`, details: { sha256: e.sha256 } });
  res.status(201).json({ evidence: { ...e, url: `/uploads/${e.filename}` } });
});

router.delete('/:id/evidence/:eid', async (req, res) => {
  const r = await loadVisible(req.params.id, req.user);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  if (r.status === 'sealed') return res.status(409).json({ error: 'This record is sealed.' });
  const { rows: [e] } = await query('DELETE FROM evidence WHERE id = $1 AND record_id = $2 RETURNING filename', [req.params.eid, r.id]);
  if (e) fs.rmSync(path.join(UPLOAD_DIR, e.filename), { force: true });
  res.json({ ok: true });
});

// Draft the agreement with Gemini (or the template fallback)
router.post('/:id/draft-agreement', async (req, res) => {
  const r = await loadVisible(req.params.id, req.user);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  if (r.status === 'sealed') return res.status(409).json({ error: 'This record is sealed.' });
  const parties = (await query('SELECT role, full_name, gender FROM parties WHERE record_id = $1 ORDER BY id', [r.id])).rows;
  const witnesses = (await query('SELECT full_name, title FROM witnesses WHERE record_id = $1 ORDER BY id', [r.id])).rows;
  const draft = await ai.draftAgreement(r, parties, witnesses);
  const ex = draft.extracted || {};
  await query(`UPDATE records SET agreement_en = $2, agreement_lg = $3,
      price_ugx = COALESCE(price_ugx, $4), payment_terms = COALESCE(payment_terms, $5),
      plot_description = COALESCE(plot_description, $6), updated_at = now() WHERE id = $1`,
  [r.id, draft.agreement_en, draft.agreement_lg, ex.price_ugx ? Math.round(ex.price_ugx) : null, ex.payment_terms || null, ex.plot_description || null]);
  await audit.log(null, { actor: actor(req), action: 'agreement.drafted', recordId: r.id, summary: `Agreement drafted ${draft.ai ? 'by Gemini' : 'from template'}` });
  res.json({ draft, record: await fullRecord(await loadVisible(r.id, req.user)) });
});

// Seal into the hash-chained ledger
router.post('/:id/seal', async (req, res) => {
  const r = await loadVisible(req.params.id, req.user);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  if (r.status === 'sealed') return res.status(409).json({ error: 'This record is already sealed.' });
  const full = await fullRecord(r);
  if (full.blockers.length) return res.status(422).json({ error: 'This record is not ready to seal', blockers: full.blockers });
  const hash = await tx((client) => sealRecord(client, r.id, req.user.id));
  await audit.log(null, { actor: actor(req), action: 'record.sealed', recordId: r.id, summary: `Sealed ${r.code} into the ledger`, details: { seal_hash: hash } });
  if (r.created_by !== req.user.id) await audit.notify(null, r.created_by, { kind: 'success', title: `${r.code} was sealed`, body: r.title, link: `/records/${r.id}` });
  if (full.overlaps.length) {
    await audit.notifyOfficials(null, { kind: 'danger', title: 'Boundary overlap detected', body: `${r.code} overlaps ${full.overlaps.map((o) => o.code).join(', ')}`, link: `/records/${r.id}` });
  }
  res.json({ record: await fullRecord(await loadVisible(r.id, req.user)) });
});

// QR code pointing to the public verification page
router.get('/:id/qr', async (req, res) => {
  const r = await loadVisible(req.params.id, req.user);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  const base = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base.replace(/\/$/, '')}/verify/${r.code}`;
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#1F3864', light: '#FFFFFF' } });
  res.json({ url, dataUrl });
});

module.exports = router;
module.exports.fullRecord = fullRecord;
module.exports.isOfficial = isOfficial;
