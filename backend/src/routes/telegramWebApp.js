// Two endpoints power the Telegram Mini App's login flow:
//
// POST /telegram-webapp/session { initData }
//   Called the moment the mini app opens. If this Telegram user is already
//   linked to a Whisper account, logs them straight in (no typing anything).
//   If not linked yet, tells the frontend so it can show a login/register form.
//
// POST /telegram-webapp/link { initData }   (requires a normal JWT, from
//   that login/register form)
//   Links the verified Telegram user id to the now-authenticated account.

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validateInitData } = require('../services/telegramAuth');

const router = express.Router();

router.post('/session', async (req, res) => {
  try {
    const telegramUser = validateInitData(req.body.initData, process.env.TELEGRAM_BOT_TOKEN);
    const chatId = String(telegramUser.id);

    const { rows } = await db.query(
      'SELECT id, email, pairing_code FROM users WHERE telegram_chat_id = $1',
      [chatId]
    );

    if (!rows.length) {
      return res.json({ linked: false });
    }

    const user = rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ linked: true, token, user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/link', requireAuth, async (req, res) => {
  try {
    const telegramUser = validateInitData(req.body.initData, process.env.TELEGRAM_BOT_TOKEN);
    const chatId = String(telegramUser.id);

    await db.query('UPDATE users SET telegram_chat_id = $1 WHERE id = $2', [chatId, req.userId]);
    res.json({ linked: true });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

module.exports = router;
