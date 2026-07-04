// Telegram bot: lets a user link their Whisper account and manage rules
// straight from chat, and is one of the two channels alerts are pushed to.
//
// Commands:
//   /link <PAIRING_CODE>                         - link this chat to a Whisper account
//   /setalert SYMBOL TIMEFRAME PRICE buy|sell     - create a rule
//   /myalerts                                     - list active rules
//   /delete <rule_id>                             - remove a rule

const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { refreshSubscriptions } = require('./derivClient');

let bot = null;

function init() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.startsWith('123456789')) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set - Telegram bot disabled');
    return;
  }

  const useWebhook = process.env.TELEGRAM_USE_WEBHOOK === 'true';
  bot = new TelegramBot(token, { polling: !useWebhook });

  if (useWebhook) {
    bot.setWebHook(`${process.env.TELEGRAM_WEBHOOK_URL}`);
  }

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "Welcome to Whisper 👂\n\nLink your account first:\n/link YOUR_PAIRING_CODE\n\n(Find your pairing code on the Whisper dashboard, under Account.)"
    );
  });

  bot.onText(/\/link (.+)/, async (msg, match) => {
    const code = match[1].trim().toUpperCase();
    const { rows } = await db.query('SELECT id, email FROM users WHERE pairing_code = $1', [code]);
    if (!rows.length) return bot.sendMessage(msg.chat.id, "❌ Invalid pairing code.");

    await db.query('UPDATE users SET telegram_chat_id = $1 WHERE id = $2', [
      String(msg.chat.id),
      rows[0].id,
    ]);
    bot.sendMessage(msg.chat.id, `✅ Linked to ${rows[0].email}. You'll receive alerts here.`);
  });

  bot.onText(/\/setalert (\S+) (\S+) ([\d.]+) (buy|sell)/i, async (msg, match) => {
    const user = await getUserByChatId(msg.chat.id);
    if (!user) return bot.sendMessage(msg.chat.id, 'Link your account first with /link CODE');

    const [, symbol, timeframe, price, direction] = match;
    const result = await db.query(
      `INSERT INTO rules (user_id, symbol, timeframe, target_price, direction)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user.id, symbol.toUpperCase(), timeframe, price, direction.toLowerCase()]
    );
    await refreshSubscriptions();
    bot.sendMessage(
      msg.chat.id,
      `✅ Alert #${result.rows[0].id} set: ${symbol.toUpperCase()} ${timeframe} target ${price} (${direction})`
    );
  });

  bot.onText(/\/myalerts/, async (msg) => {
    const user = await getUserByChatId(msg.chat.id);
    if (!user) return bot.sendMessage(msg.chat.id, 'Link your account first with /link CODE');

    const { rows } = await db.query(
      `SELECT id, symbol, timeframe, target_price, direction, status FROM rules
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [user.id]
    );
    if (!rows.length) return bot.sendMessage(msg.chat.id, 'No alerts yet. Use /setalert to create one.');

    const lines = rows.map(
      (r) => `#${r.id} ${r.symbol} ${r.timeframe} → ${r.target_price} (${r.direction}) [${r.status}]`
    );
    bot.sendMessage(msg.chat.id, lines.join('\n'));
  });

  bot.onText(/\/delete (\d+)/, async (msg, match) => {
    const user = await getUserByChatId(msg.chat.id);
    if (!user) return bot.sendMessage(msg.chat.id, 'Link your account first with /link CODE');

    const result = await db.query('DELETE FROM rules WHERE id = $1 AND user_id = $2 RETURNING id', [
      match[1],
      user.id,
    ]);
    bot.sendMessage(msg.chat.id, result.rows.length ? `🗑️ Deleted alert #${match[1]}` : 'Alert not found.');
  });

  console.log('[telegram] bot started (' + (useWebhook ? 'webhook' : 'polling') + ')');
}

async function getUserByChatId(chatId) {
  const { rows } = await db.query('SELECT id, email FROM users WHERE telegram_chat_id = $1', [String(chatId)]);
  return rows[0] || null;
}

async function sendAlertToChat(chatId, text) {
  if (!bot) return;
  try {
    await bot.sendMessage(chatId, text);
  } catch (err) {
    console.error('[telegram] send failed:', err.message);
  }
}

function getWebhookHandler() {
  return (req, res) => {
    if (bot) bot.processUpdate(req.body);
    res.sendStatus(200);
  };
}

module.exports = { init, sendAlertToChat, getWebhookHandler };
