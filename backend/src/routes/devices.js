const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /devices  { fcm_token }
// Called by the Android app after login + Firebase gives it a token.
router.post('/', async (req, res) => {
  const { fcm_token } = req.body;
  if (!fcm_token) return res.status(400).json({ error: 'fcm_token is required' });

  await db.query(
    `INSERT INTO devices (user_id, fcm_token, platform)
     VALUES ($1, $2, 'android')
     ON CONFLICT (user_id, fcm_token) DO NOTHING`,
    [req.userId, fcm_token]
  );
  res.status(201).json({ registered: true });
});

// DELETE /devices  { fcm_token } - e.g. on logout
router.delete('/', async (req, res) => {
  const { fcm_token } = req.body;
  await db.query('DELETE FROM devices WHERE user_id = $1 AND fcm_token = $2', [req.userId, fcm_token]);
  res.json({ removed: true });
});

module.exports = router;
