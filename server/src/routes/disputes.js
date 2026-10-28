const router = require('express').Router();
const { query } = require('../db');
const { requireAuth, requireRole } = require('../lib/auth');
const { visibleWhere, loadVisible } = require('../lib/access');
const { isOfficial } = require('../lib/records');
const audit = require('../lib/audit');

router.use(requireAuth);

const STAGES = ['reported', 'lc_review', 'mediation', 'resolved', 'escalated'];
const STAGE_LABEL = { reported: 'Reported', lc_review: 'LC review', mediation: 'Mediation', resolved: 'Resolved', escalated: 'Escalated to court' };
const CATEGORIES = ['boundary', 'ownership', 'inheritance', 'eviction', 'double_sale', 'payment', 'other'];

const SELECT = `
  SELECT d.*, r.code, r.title AS record_title, r.district, r.village, r.record_type, r.created_by AS record_owner,
         u.full_name AS mediator_name, CASE WHEN u.photo IS NOT NULL THEN '/uploads/' || u.photo END AS mediator_photo, c.full_name AS created_by_name,
         EXTRACT(EPOCH FROM (COALESCE(d.resolved_at, now()) - d.created_at)) / 86400 AS age_days
  FROM disputes d
  JOIN records r ON r.id = d.record_id
  LEFT JOIN users u ON u.id = d.mediator_id
  LEFT JOIN users c ON c.id = d.created_by`;

router.get('/', async (req, res) => {
  const params = [];
  const where = [visibleWhere(req.user, params)];
  if (req.query.stage) { params.push(req.query.stage); where.push(`d.stage = $${params.length}`); }
  if (req.query.category) { params.push(req.query.category); where.push(`d.category = $${params.length}`); }
  if (req.query.q) { params.push(`%${String(req.query.q).toLowerCase()}%`); where.push(`(lower(d.title) LIKE $${params.length} OR lower(r.code) LIKE $${params.length} OR lower(coalesce(d.complainant,'')) LIKE $${params.length})`); }
  const { rows } = await query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY
    CASE d.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, d.updated_at DESC`, params);
  const sessions = rows.filter((d) => d.session_at && new Date(d.session_at) > new Date(Date.now() - 3600e3) && d.stage !== 'resolved')
    .sort((a, b) => new Date(a.session_at) - new Date(b.session_at));
  res.json({ disputes: rows, sessions, stages: STAGES.map((s) => ({ id: s, label: STAGE_LABEL[s], count: rows.filter((d) => d.stage === s).length })) });
});

router.get('/mediators', async (req, res) => {
  const { rows } = await query("SELECT id, full_name, title, district, role FROM users WHERE role IN ('mediator','lc_official') AND active ORDER BY role DESC, full_name");
  res.json({ mediators: rows });
});

router.post('/', async (req, res) => {
  const { record_id, title, description, category = 'ownership', priority = 'medium', complainant, respondent, referred_to } = req.body;
  const r = await loadVisible(record_id, req.user);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  if (!description || !String(description).trim()) return res.status(400).json({ error: 'Describe the dispute' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category' });
  const { rows: [d] } = await query(
    `INSERT INTO disputes (record_id, title, description, category, priority, complainant, respondent, referred_to, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [r.id, title || `${category.replace('_', ' ')} dispute on ${r.code}`, description, category, ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      complainant || null, respondent || null, referred_to || null, req.user.id]);
  await audit.log(null, { actor: { id: req.user.id, name: req.user.name }, action: 'dispute.reported', recordId: r.id, summary: `Reported a ${category.replace('_', ' ')} dispute: ${d.title}` });
  await audit.notifyOfficials(null, { kind: 'warning', title: 'New land dispute reported', body: `${r.code} · ${d.title}`, link: '/disputes' });
  res.status(201).json({ dispute: d });
});

router.patch('/:id', requireRole('lc_official', 'mediator', 'admin'), async (req, res) => {
  const { rows: [d] } = await query('SELECT d.*, r.code, r.created_by AS owner FROM disputes d JOIN records r ON r.id = d.record_id WHERE d.id = $1', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'Dispute not found' });
  const sets = []; const params = [d.id];
  const put = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  const b = req.body;
  if (b.stage !== undefined) {
    if (!STAGES.includes(b.stage)) return res.status(400).json({ error: 'Unknown stage' });
    put('stage', b.stage);
    put('resolved_at', b.stage === 'resolved' ? new Date() : null);
  }
  if (b.priority !== undefined) put('priority', b.priority);
  if (b.mediator_id !== undefined) put('mediator_id', b.mediator_id || null);
  if (b.session_at !== undefined) put('session_at', b.session_at || null);
  if (b.venue !== undefined) put('venue', b.venue || null);
  if (b.outcome !== undefined) put('outcome', b.outcome || null);
  if (!sets.length) return res.json({ dispute: d });
  await query(`UPDATE disputes SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
  const changes = [];
  if (b.stage && b.stage !== d.stage) changes.push(`moved to ${STAGE_LABEL[b.stage]}`);
  if (b.session_at) changes.push(`mediation session set for ${new Date(b.session_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' })}`);
  if (b.outcome) changes.push('outcome recorded');
  if (changes.length) {
    await audit.log(null, { actor: { id: req.user.id, name: req.user.name }, action: 'dispute.updated', recordId: d.record_id, summary: `Dispute "${d.title}" ${changes.join(', ')}` });
    await audit.notify(null, d.owner, { kind: b.stage === 'resolved' ? 'success' : 'info', title: `Dispute on ${d.code} ${changes[0]}`, body: d.title, link: '/disputes' });
  }
  const { rows: [out] } = await query(`${SELECT} WHERE d.id = $1`, [d.id]);
  res.json({ dispute: out });
});

module.exports = router;
module.exports.STAGES = STAGES;
module.exports.isOfficial = isOfficial;
