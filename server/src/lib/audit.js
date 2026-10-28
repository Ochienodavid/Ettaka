const { query } = require('../db');

// Record an action in the audit trail. Never throws: auditing must not break the request.
async function log(db, { actor, action, recordId = null, summary, details = {}, at = null }) {
  try {
    await (db || { query }).query(
      `INSERT INTO activity (actor_id, actor_name, action, record_id, summary, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))`,
      [actor?.id || null, actor?.name || actor?.full_name || 'System', action, recordId, summary, JSON.stringify(details), at]);
  } catch (e) { console.error('audit log failed:', e.message); }
}

async function notify(db, userId, { kind = 'info', title, body = null, link = null, at = null }) {
  if (!userId) return;
  try {
    await (db || { query }).query(
      'INSERT INTO notifications (user_id, kind, title, body, link, created_at) VALUES ($1,$2,$3,$4,$5, COALESCE($6, now()))',
      [userId, kind, title, body, link, at]);
  } catch (e) { console.error('notify failed:', e.message); }
}

// Notify every LC official, mediator and admin.
async function notifyOfficials(db, payload) {
  const { rows } = await (db || { query }).query("SELECT id FROM users WHERE role IN ('lc_official','mediator','admin') AND active");
  for (const r of rows) await notify(db, r.id, payload);
}

module.exports = { log, notify, notifyOfficials };
