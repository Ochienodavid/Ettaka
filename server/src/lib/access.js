const { query } = require('../db');
const { isOfficial } = require('./records');
const { overlap } = require('./geo');

// SQL fragment: records visible to a user. Citizens see records they created
// and records where their phone number is listed as a party.
function visibleWhere(user, params, alias = 'r') {
  if (isOfficial(user)) return 'TRUE';
  params.push(user.id);
  const a = params.length;
  return `(${alias}.created_by = $${a} OR EXISTS (SELECT 1 FROM parties px JOIN users ux ON ux.phone = px.phone WHERE px.record_id = ${alias}.id AND ux.id = $${a}))`;
}

async function loadVisible(id, user) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const params = [id];
  const { rows: [r] } = await query(`SELECT r.* FROM records r WHERE r.id = $1 AND ${visibleWhere(user, params)}`, params);
  return r || null;
}

// Other records whose boundaries overlap this one.
async function overlapsFor(record) {
  if (!Array.isArray(record.boundary) || record.boundary.length < 3) return [];
  const { rows } = await query(
    "SELECT id, code, title, record_type, status, boundary FROM records WHERE id <> $1 AND jsonb_array_length(boundary) >= 3", [record.id]);
  return rows.map((o) => {
    const ov = overlap(record.boundary, o.boundary);
    return ov && ov.pct_of_smaller >= 2 ? { id: o.id, code: o.code, title: o.title, record_type: o.record_type, status: o.status, ...ov } : null;
  }).filter(Boolean);
}

module.exports = { visibleWhere, loadVisible, overlapsFor };
