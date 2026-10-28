const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
function newCode() {
  const pick = () => Array.from(crypto.randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `ETK-${pick()}-${pick()}`;
}

const REQUIRED_ROLES = {
  sale: ['seller', 'buyer'],
  gift: ['donor', 'recipient'],
  inheritance: ['owner', 'heir'],
  customary_claim: ['owner'],
};

// Risk flags shown to users, LC officials and verifiers.
function computeFlags(r, parties, witnesses, overlaps = []) {
  const flags = [];
  for (const o of overlaps) {
    flags.push({ level: 'danger', code: `BOUNDARY_OVERLAP_${o.code}`, message: `The boundary overlaps ${o.pct_of_smaller}% of record ${o.code} (${o.title}). This may be a double sale or a boundary dispute.`, related: o.code, record_id: o.id });
  }
  const transfer = ['sale', 'gift'].includes(r.record_type);
  if (r.family_land && transfer && !r.spouse_consent) {
    flags.push({ level: 'danger', code: 'SPOUSE_CONSENT_MISSING', message: 'Family land is being transferred without recorded spousal consent. Under the Land Act this transaction may be void.' });
  }
  if (!parties.some((p) => p.gender === 'female')) {
    flags.push({ level: 'info', code: 'NO_WOMAN_NAMED', message: 'No woman is named on this record. If a wife, widow or daughter has a claim, add her as a party.' });
  }
  if (!witnesses.some((w) => /lc ?1|lc ?i\b|chair/i.test(w.title || ''))) {
    flags.push({ level: 'warning', code: 'NO_LC1_WITNESS', message: 'No LC1 chairperson or local leader is listed as a witness.' });
  }
  if (witnesses.length < 2) {
    flags.push({ level: 'warning', code: 'FEW_WITNESSES', message: 'Fewer than two witnesses are recorded.' });
  }
  if (!Array.isArray(r.boundary) || r.boundary.length < 3) {
    flags.push({ level: 'warning', code: 'BOUNDARY_NOT_MAPPED', message: 'The boundary has not been mapped.' });
  }
  return flags;
}

// Conditions a record must meet before it can be sealed.
function sealBlockers(r, parties, witnesses) {
  const out = [];
  const missing = (REQUIRED_ROLES[r.record_type] || []).filter((role) => !parties.some((p) => p.role === role));
  if (missing.length) out.push(`Add the ${missing.join(' and ')}.`);
  if (!witnesses.length) out.push('Add at least one witness.');
  if (!Array.isArray(r.boundary) || r.boundary.length < 3) out.push('Map the boundary with at least three points.');
  if (!r.agreement_en) out.push('Generate the agreement before sealing.');
  if (r.family_land && ['sale', 'gift'].includes(r.record_type) && !r.spouse_consent) {
    out.push('Record the spouse\'s consent: family land cannot be transferred without it.');
  }
  return out;
}

const OFFICIAL_ROLES = ['lc_official', 'mediator', 'admin'];
const isOfficial = (u) => OFFICIAL_ROLES.includes(u?.role);

const maskPhone = (p) => (p ? `${p.slice(0, 4)}•••${p.slice(-2)}` : null);

module.exports = { OFFICIAL_ROLES, isOfficial, newCode, computeFlags, sealBlockers, maskPhone, REQUIRED_ROLES };
