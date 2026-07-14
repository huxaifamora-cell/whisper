// Generates a short-lived, one-time token used to link Telegram without
// ever putting the user's email in a URL. The dashboard calls this while
// the user is already logged in, then opens the returned Telegram deep
// link - the bot reads the token (not an email) and links that chat.

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

router.post('/', async (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.query('UPDATE users SET link_token = $1, link_token_expires_at = $2 WHERE id = $3', [
    token,
    expiresAt,
    req.userId,
  ]);

  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '');
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${token}` : null;

  res.json({ token, expires_at: expiresAt, telegram_deep_link: deepLink });
});

module.exports = router;
