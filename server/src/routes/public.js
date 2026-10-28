// Public endpoints: verification portal, rights assistant, AI helpers, demo tools.
const router = require('express').Router();
const multer = require('multer');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../lib/auth');
const { verifyRecord } = require('../lib/seal');
const crypto = require('crypto');
const { computeFlags, maskPhone } = require('../lib/records');
const { overlapsFor } = require('../lib/access');
const audit = require('../lib/audit');
const { retrieve, CORPUS } = require('../lib/legalCorpus');
const ai = require('../lib/ai');

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ---- Verification portal (anyone holding the code or QR) ----
const VERIFIER_TYPES = ['public', 'buyer', 'lender', 'mediator', 'court', 'official'];
const VERIFIER_LABEL = { public: 'someone', buyer: 'a prospective buyer', lender: 'a lender', mediator: 'a mediator', court: 'a court', official: 'an official' };
router.get('/verify/:code', async (req, res) => {
  const code = String(req.params.code).toUpperCase().trim().slice(0, 40);
  const as = VERIFIER_TYPES.includes(req.query.as) ? req.query.as : 'public';
  const ipHash = crypto.createHash('sha256').update(`${req.ip}|ettaka`).digest('hex').slice(0, 16);
  const { rows: [r] } = await query('SELECT * FROM records WHERE code = $1', [code]);
  if (!r) {
    await query('INSERT INTO verifications (code, found, valid, verifier_type, ip_hash) VALUES ($1, false, null, $2, $3)', [code, as, ipHash]);
    return res.status(404).json({ found: false, error: 'No Ettaka record has this code. The document may be forged or the code mistyped.' });
  }
  const parties = (await query('SELECT role, full_name, phone, gender FROM parties WHERE record_id = $1 ORDER BY id', [r.id])).rows;
  const witnesses = (await query('SELECT full_name, title FROM witnesses WHERE record_id = $1 ORDER BY id', [r.id])).rows;
  const verification = r.status === 'sealed' ? await verifyRecord({ query }, r.id) : { sealed: false, valid: false, checks: [] };
  const disputes = (await query("SELECT stage, category, created_at FROM disputes WHERE record_id = $1 AND stage <> 'resolved'", [r.id])).rows;
  const overlaps = await overlapsFor(r);
  const { rows: [vc] } = await query('SELECT count(*)::int AS n FROM verifications WHERE record_id = $1', [r.id]);
  await query('INSERT INTO verifications (code, record_id, found, valid, verifier_type, ip_hash) VALUES ($1,$2,true,$3,$4,$5)',
    [code, r.id, verification.valid, as, ipHash]);
  if (req.query.notify !== 'false') {
    await audit.notify(null, r.created_by, {
      kind: verification.valid ? 'info' : 'danger',
      title: verification.valid ? `${r.code} was verified by ${VERIFIER_LABEL[as]}` : `ALERT: ${r.code} failed verification`,
      body: verification.valid ? 'The record was confirmed authentic and unaltered.' : 'The record no longer matches its seal. Contact your LC1 chairperson.',
      link: `/records/${r.id}`,
    });
  }
  res.json({
    found: true,
    record: {
      code: r.code, title: r.title, record_type: r.record_type, status: r.status, tenure: r.tenure,
      location: [r.village, r.subcounty, r.district].filter(Boolean).join(', '),
      plot_description: r.plot_description,
      price_ugx: r.price_ugx, area_m2: r.area_m2, boundary: r.boundary, sealed_at: r.sealed_at,
      family_land: r.family_land, spouse_consent: r.spouse_consent,
      parties: parties.map((p) => ({ ...p, phone: maskPhone(p.phone) })),
      witnesses,
    },
    verification,
    flags: computeFlags(r, parties, witnesses, overlaps),
    overlaps: overlaps.map(({ code, title, record_type, status, pct_of_smaller, area_m2 }) => ({ code, title, record_type, status, pct_of_smaller, area_m2 })),
    open_disputes: disputes.length,
    disputes,
    times_verified: vc.n + 1,
  });
});

// ---- Public impact figures for the landing page ----
router.get('/public/stats', async (req, res) => {
  const { rows: [s] } = await query(`SELECT
      (SELECT count(*) FROM records WHERE status = 'sealed')::int AS sealed,
      (SELECT COALESCE(sum(area_m2), 0) / 4046.86 FROM records WHERE status = 'sealed')::float AS acres,
      (SELECT count(*) FROM verifications)::int AS verifications,
      (SELECT count(DISTINCT district) FROM records)::int AS districts,
      (SELECT count(*) FROM disputes WHERE stage = 'resolved')::int AS resolved,
      (SELECT count(*) FROM records r WHERE EXISTS (SELECT 1 FROM parties p WHERE p.record_id = r.id AND p.gender = 'female'))::int AS with_women,
      (SELECT count(*) FROM records)::int AS records,
      (SELECT count(*) FROM seals)::int AS ledger`);
  res.json({ ...s, women_pct: s.records ? Math.round((s.with_women / s.records) * 100) : 0 });
});

// ---- Know My Rights assistant ----
router.post('/ai/rights', async (req, res) => {
  const question = String(req.body.question || '').trim().slice(0, 1000);
  if (!question) return res.status(400).json({ error: 'Ask a question' });
  const passages = retrieve(question);
  try {
    res.json(await ai.answerRights(question, passages, req.body.language));
  } catch (e) {
    res.json({ ...(await ai.answerRights(question, passages, 'fallback-no-ai')), note: `Gemini unavailable: ${e.message}` });
  }
});

router.get('/ai/library', (req, res) => res.json({ entries: CORPUS.map(({ keywords, ...rest }) => rest) }));

router.get('/ai/status', (req, res) => res.json({ gemini: ai.enabled(), model: ai.enabled() ? ai.MODEL : null }));

// ---- AI helpers that need a signed-in user ----
router.post('/ai/transcribe', requireAuth, memUpload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach an audio recording' });
  try { res.json(await ai.transcribe(req.file.buffer, req.file.mimetype)); } catch (e) { res.status(502).json({ error: `Transcription failed: ${e.message}` }); }
});

router.post('/ai/digitise', requireAuth, memUpload.single('image'), async (req, res) => {
  if (!req.file || !/^image\/|application\/pdf/.test(req.file.mimetype)) return res.status(400).json({ error: 'Attach a photo or PDF of the document' });
  try { res.json(await ai.extractDocument(req.file.buffer, req.file.mimetype)); } catch (e) { res.status(502).json({ error: `Could not read the document: ${e.message}` }); }
});

// ---- Demo tools: simulate an insider editing a sealed record in the database ----
const demoOn = () => process.env.DEMO_MODE !== 'false';
router.post('/demo/tamper/:code', requireAuth, requireRole('lc_official', 'admin'), async (req, res) => {
  if (!demoOn()) return res.status(404).end();
  const { rows: [r] } = await query("SELECT * FROM records WHERE code = $1 AND status = 'sealed'", [req.params.code]);
  if (!r) return res.status(404).json({ error: 'Sealed record not found' });
  if (req.body.field === 'boundary') {
    const b = r.boundary.map((p, i) => (i === 0 ? [p[0] + 0.0004, p[1] + 0.0004] : p));
    await query('UPDATE records SET boundary = $2 WHERE id = $1', [r.id, JSON.stringify(b)]);
  } else {
    await query('UPDATE records SET price_ugx = COALESCE(price_ugx, 0) + 5000000 WHERE id = $1', [r.id]);
  }
  await audit.log(null, { actor: { id: req.user.id, name: req.user.name }, action: 'demo.tamper', recordId: r.id, summary: `DEMO: altered ${req.body.field === 'boundary' ? 'a boundary point' : 'the price'} directly in the database` });
  res.json({ ok: true, message: 'Record altered directly in the database, bypassing the app.' });
});

router.post('/demo/restore/:code', requireAuth, requireRole('lc_official', 'admin'), async (req, res) => {
  if (!demoOn()) return res.status(404).end();
  const { rows: [r] } = await query('SELECT id FROM records WHERE code = $1', [req.params.code]);
  if (!r) return res.status(404).json({ error: 'Record not found' });
  const { rows: [seal] } = await query('SELECT payload FROM seals WHERE record_id = $1 ORDER BY id DESC LIMIT 1', [r.id]);
  if (!seal) return res.status(404).json({ error: 'Record is not sealed' });
  await query('UPDATE records SET price_ugx = $2, boundary = $3 WHERE id = $1',
    [r.id, seal.payload.price_ugx, JSON.stringify(seal.payload.boundary)]);
  await audit.log(null, { actor: { id: req.user.id, name: req.user.name }, action: 'demo.restore', recordId: r.id, summary: 'DEMO: restored the sealed values' });
  res.json({ ok: true });
});

module.exports = router;
