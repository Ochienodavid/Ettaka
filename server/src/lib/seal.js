const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GENESIS = '0'.repeat(64);
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

// Deterministic JSON: object keys sorted at every level, so the same content
// always produces the same hash.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

const fileHash = (filename) => sha256(fs.readFileSync(path.join(UPLOAD_DIR, filename)));

// The exact content a seal commits to.
async function buildPayload(db, recordId) {
  const { rows: [r] } = await db.query('SELECT * FROM records WHERE id = $1', [recordId]);
  if (!r) return null;
  const parties = (await db.query(
    `SELECT p.role, p.full_name, p.phone, p.gender, e.sha256 AS photo FROM parties p LEFT JOIN evidence e ON e.id = p.photo_evidence_id
     WHERE p.record_id = $1 ORDER BY p.id`, [recordId])).rows;
  const witnesses = (await db.query(
    `SELECT w.full_name, w.title, w.phone, w.statement, e.sha256 AS photo FROM witnesses w LEFT JOIN evidence e ON e.id = w.photo_evidence_id
     WHERE w.record_id = $1 ORDER BY w.id`, [recordId])).rows;
  const evidence = (await db.query(
    'SELECT kind, sha256, caption, lat, lng FROM evidence WHERE record_id = $1 ORDER BY id', [recordId])).rows;

  return {
    version: 1,
    code: r.code,
    record_type: r.record_type,
    title: r.title,
    location: { district: r.district, subcounty: r.subcounty, village: r.village },
    tenure: r.tenure,
    plot_description: r.plot_description,
    price_ugx: r.price_ugx === null ? null : String(r.price_ugx),
    payment_terms: r.payment_terms,
    agreement_en: r.agreement_en,
    agreement_lg: r.agreement_lg,
    family_land: r.family_land,
    spouse_name: r.spouse_name,
    spouse_consent: r.spouse_consent,
    boundary: r.boundary,
    area_m2: r.area_m2 === null ? null : Number(r.area_m2).toFixed(2),
    parties,
    witnesses,
    evidence,
  };
}

const computeSeal = (payload, prevHash, sealedAtIso) =>
  sha256(canonical({ payload, prev_hash: prevHash, sealed_at: sealedAtIso }));

// Full verification of one record: contents vs. seal, ledger chain, files on disk.
async function verifyRecord(db, recordId) {
  const { rows: [seal] } = await db.query(
    'SELECT * FROM seals WHERE record_id = $1 ORDER BY id DESC LIMIT 1', [recordId]);
  if (!seal) return { sealed: false, valid: false, checks: [] };

  const checks = [];
  const current = await buildPayload(db, recordId);
  const sealedAtIso = new Date(seal.sealed_at).toISOString();
  const recomputed = computeSeal(current, seal.prev_hash, sealedAtIso);
  const contentOk = recomputed === seal.seal_hash;
  checks.push({ id: 'content', label: 'Record contents match the seal', ok: contentOk });

  const storedOk = computeSeal(seal.payload, seal.prev_hash, sealedAtIso) === seal.seal_hash;
  checks.push({ id: 'ledger_entry', label: 'Ledger entry is intact', ok: storedOk });

  const { rows: [prev] } = await db.query(
    'SELECT seal_hash FROM seals WHERE id < $1 ORDER BY id DESC LIMIT 1', [seal.id]);
  const chainOk = seal.prev_hash === (prev ? prev.seal_hash : GENESIS);
  checks.push({ id: 'chain', label: 'Linked correctly to the previous ledger entry', ok: chainOk });

  const files = (await db.query('SELECT filename, sha256 FROM evidence WHERE record_id = $1', [recordId])).rows;
  let filesOk = true;
  for (const f of files) {
    try { if (fileHash(f.filename) !== f.sha256) filesOk = false; } catch { filesOk = false; }
  }
  checks.push({ id: 'files', label: `Evidence files unaltered (${files.length})`, ok: filesOk });

  const changes = contentOk ? [] : diffPayload(seal.payload, current);
  return {
    sealed: true,
    valid: checks.every((c) => c.ok),
    seal_hash: seal.seal_hash,
    prev_hash: seal.prev_hash,
    sealed_at: sealedAtIso,
    ledger_position: seal.id,
    checks,
    changes,
  };
}

// Human-readable list of fields that differ between sealed and current content.
function diffPayload(a, b, prefix = '') {
  const out = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const name = prefix ? `${prefix}.${k}` : k;
    const va = a ? a[k] : undefined;
    const vb = b ? b[k] : undefined;
    if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va)) {
      out.push(...diffPayload(va, vb, name));
    } else if (canonical(va) !== canonical(vb)) {
      out.push({ field: name, sealed: va, current: vb });
    }
  }
  return out;
}

// Seal a record inside an open transaction. Caller has already validated it.
async function sealRecord(client, recordId, userId, at = new Date()) {
  await client.query('SELECT pg_advisory_xact_lock(4242)'); // one writer at a time keeps the chain linear
  const sealedAt = new Date(at);
  sealedAt.setMilliseconds(0);
  await client.query("UPDATE records SET status = 'sealed', sealed_at = $2, updated_at = now() WHERE id = $1", [recordId, sealedAt]);
  await client.query('UPDATE parties SET confirmed = true, confirmed_at = $2 WHERE record_id = $1', [recordId, sealedAt]);
  await client.query('UPDATE witnesses SET confirmed = true WHERE record_id = $1', [recordId]);
  const payload = await buildPayload(client, recordId);
  const { rows: [last] } = await client.query('SELECT seal_hash FROM seals ORDER BY id DESC LIMIT 1');
  const prev = last ? last.seal_hash : GENESIS;
  const hash = computeSeal(payload, prev, sealedAt.toISOString());
  await client.query('INSERT INTO seals (record_id, seal_hash, prev_hash, payload, sealed_by, sealed_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [recordId, hash, prev, JSON.stringify(payload), userId, sealedAt]);
  return hash;
}

// Verify the entire ledger: every entry's stored payload, every chain link,
// and whether each record still matches its seal.
async function verifyLedger(db) {
  const { rows } = await db.query(`
    SELECT s.*, r.code, r.title, u.full_name AS sealed_by_name
    FROM seals s JOIN records r ON r.id = s.record_id LEFT JOIN users u ON u.id = s.sealed_by
    ORDER BY s.id`);
  let prev = GENESIS;
  let brokenAt = null;
  const blocks = [];
  for (const s of rows) {
    const at = new Date(s.sealed_at).toISOString();
    const entryOk = computeSeal(s.payload, s.prev_hash, at) === s.seal_hash;
    const linkOk = s.prev_hash === prev;
    const current = await buildPayload(db, s.record_id);
    const contentOk = computeSeal(current, s.prev_hash, at) === s.seal_hash;
    const ok = entryOk && linkOk && contentOk;
    if (!ok && brokenAt === null) brokenAt = s.id;
    blocks.push({
      position: s.id, code: s.code, title: s.title, record_id: s.record_id, seal_hash: s.seal_hash, prev_hash: s.prev_hash,
      sealed_at: at, sealed_by: s.sealed_by_name, entry_ok: entryOk, link_ok: linkOk, content_ok: contentOk, ok,
    });
    prev = s.seal_hash;
  }
  return { valid: brokenAt === null, length: rows.length, head: prev, first_problem: brokenAt, checked_at: new Date().toISOString(), blocks };
}

module.exports = { sealRecord, verifyLedger,  GENESIS, UPLOAD_DIR, sha256, canonical, buildPayload, computeSeal, verifyRecord, fileHash };
