const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { sign, requireAuth } = require('../lib/auth');
const audit = require('../lib/audit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOAD_DIR } = require('../lib/seal');

const photoUpload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (req, file, cb) => cb(null, `u-${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname || '.jpg').toLowerCase().slice(0, 6)}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const photoUrl = (f) => (f ? `/uploads/${f}` : null);

const normPhone = (p) => String(p || '').replace(/[^\d+]/g, '');

router.post('/register', async (req, res) => {
  const { full_name, phone, pin } = req.body;
  if (!full_name || !normPhone(phone) || !/^\d{4,6}$/.test(String(pin || ''))) {
    return res.status(400).json({ error: 'Enter your name, phone number and a 4 to 6 digit PIN' });
  }
  const exists = await query('SELECT 1 FROM users WHERE phone = $1', [normPhone(phone)]);
  if (exists.rowCount) return res.status(409).json({ error: 'This phone number is already registered' });
  const { rows: [user] } = await query(
    'INSERT INTO users (full_name, phone, pin_hash) VALUES ($1, $2, $3) RETURNING id, full_name, phone, role, title, district',
    [full_name.trim(), normPhone(phone), await bcrypt.hash(String(pin), 10)]);
  res.status(201).json({ token: sign(user), user });
});

router.post('/login', async (req, res) => {
  const { phone, pin } = req.body;
  const { rows: [user] } = await query('SELECT * FROM users WHERE phone = $1', [normPhone(phone)]);
  if (!user || !(await bcrypt.compare(String(pin || ''), user.pin_hash))) {
    return res.status(401).json({ error: 'Phone number or PIN is incorrect' });
  }
  if (!user.active) return res.status(403).json({ error: 'This account has been deactivated. Contact your administrator.' });
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  await audit.log(null, { actor: user, action: 'auth.login', summary: `${user.full_name} signed in` });
  const { pin_hash, ...safe } = user;
  res.json({ token: sign(user), user: { ...safe, photo_url: photoUrl(user.photo) } });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows: [user] } = await query('SELECT id, full_name, phone, role, title, district, last_login_at, photo FROM users WHERE id = $1', [req.user.id]);
  res.json({ user: { ...user, photo_url: photoUrl(user.photo) } });
});

router.post('/me/photo', requireAuth, photoUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a JPG, PNG or WebP image up to 5 MB' });
  const { rows: [old] } = await query('SELECT photo FROM users WHERE id = $1', [req.user.id]);
  await query('UPDATE users SET photo = $2 WHERE id = $1', [req.user.id, req.file.filename]);
  if (old?.photo) fs.rmSync(path.join(UPLOAD_DIR, old.photo), { force: true });
  await audit.log(null, { actor: { id: req.user.id, name: req.user.name }, action: 'user.photo', summary: 'Updated profile photo' });
  res.json({ photo_url: photoUrl(req.file.filename) });
});

router.delete('/me/photo', requireAuth, async (req, res) => {
  const { rows: [old] } = await query('SELECT photo FROM users WHERE id = $1', [req.user.id]);
  await query('UPDATE users SET photo = NULL WHERE id = $1', [req.user.id]);
  if (old?.photo) fs.rmSync(path.join(UPLOAD_DIR, old.photo), { force: true });
  res.json({ ok: true });
});

module.exports = router;
