const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

function generatePairingCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A1B2C3D4"
}

// POST /auth/register  { email, password }
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'email and password (6+ chars) are required' });
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const pairingCode = generatePairingCode();

  const result = await db.query(
    `INSERT INTO users (email, password_hash, pairing_code) VALUES ($1, $2, $3)
     RETURNING id, email, pairing_code`,
    [email, passwordHash, pairingCode]
  );

  const user = result.rows[0];
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

  res.status(201).json({ token, user });
});

// POST /auth/login  { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: { id: user.id, email: user.email, pairing_code: user.pairing_code },
  });
});

module.exports = router;
