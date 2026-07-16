// Telegram bot: lets a user open the Whisper Mini App (a full web UI inside
// Telegram) to sign in, manage alerts, and see history - and also supports
// a few quick chat commands for people who prefer typing.
//
// Commands:
//   /app                                          - open the Whisper Mini App
//   /start <token>                                - one-time link from the dashboard's Connect page
//   /setalert SYMBOL TIMEFRAME PRICE buy|sell     - create a rule
//   /myalerts                                     - list active rules
//   /delete <rule_id>                             - remove a rule

const TelegramBot = require('node-telegram-bot-api');
const db = require('../db');
const { refreshSubscriptions } = require('./derivClient');
const { normalizeSymbol, labelForSymbol } = require('../constants/symbols');

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

  bot.onText(/\/app/, (msg) => {
    sendOpenAppButton(msg.chat.id);
  });

  // Persistent "Open App" button next to the message input, so people don't
  // need to remember /app - shows every time they open this chat.
  const webAppUrl = getWebAppUrl();
  if (webAppUrl) {
    bot.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'Open Whisper', web_app: { url: webAppUrl } },
    }).catch((err) => console.warn('[telegram] could not set menu button:', err.message));
  }

  bot.onText(/\/start(?:\s+(\S+))?/, async (msg, match) => {
    const token = match[1];

    if (!token) {
      sendOpenAppButton(msg.chat.id, "Welcome to Whisper 👂\n\nOpen the app below to sign in, manage alerts, and see your history - all without leaving Telegram.");
      return;
    }

    const { rows } = await db.query(
      `SELECT id, email FROM users WHERE link_token = $1 AND link_token_expires_at > now()`,
      [token]
    );

    if (!rows.length) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ That link has expired or was already used. Go back to the dashboard\'s Connect page and generate a fresh one.'
      );
    }

    await db.query(
      `UPDATE users SET telegram_chat_id = $1, link_token = NULL, link_token_expires_at = NULL WHERE id = $2`,
      [String(msg.chat.id), rows[0].id]
    );
    bot.sendMessage(msg.chat.id, `✅ Linked to ${rows[0].email}. You'll receive alerts here.`);
  });

  bot.onText(/\/setalert (\S+) (\S+) ([\d.]+) (buy|sell)/i, async (msg, match) => {
    const user = await getUserByChatId(msg.chat.id);
    if (!user) return bot.sendMessage(msg.chat.id, 'Link your account first - tap /app to open Whisper and sign in');

    const [, symbol, timeframe, price, direction] = match;
    const canonicalSymbol = normalizeSymbol(symbol);
    if (!canonicalSymbol) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ "${symbol}" isn't a recognized symbol code. Use codes like R_75, R_100, 1HZ15V, frxEURUSD (check the dashboard for the full list).`
      );
    }
    const result = await db.query(
      `INSERT INTO rules (user_id, symbol, timeframe, target_price, direction)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user.id, canonicalSymbol, timeframe, price, direction.toLowerCase()]
    );
    await refreshSubscriptions();
    bot.sendMessage(
      msg.chat.id,
      `✅ Alert #${result.rows[0].id} set: ${labelForSymbol(canonicalSymbol)} ${timeframe} target ${price} (${direction})`
    );
  });

  bot.onText(/\/myalerts/, async (msg) => {
    const user = await getUserByChatId(msg.chat.id);
    if (!user) return bot.sendMessage(msg.chat.id, 'Link your account first - tap /app to open Whisper and sign in');

    const { rows } = await db.query(
      `SELECT id, symbol, timeframe, target_price, direction, status FROM rules
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [user.id]
    );
    if (!rows.length) return bot.sendMessage(msg.chat.id, 'No alerts yet. Use /setalert to create one.');

    const lines = rows.map(
      (r) => `#${r.id} ${labelForSymbol(r.symbol)} ${r.timeframe} → ${r.target_price} (${r.direction}) [${r.status}]`
    );
    bot.sendMessage(msg.chat.id, lines.join('\n'));
  });

  bot.onText(/\/delete (\d+)/, async (msg, match) => {
    const user = await getUserByChatId(msg.chat.id);
    if (!user) return bot.sendMessage(msg.chat.id, 'Link your account first - tap /app to open Whisper and sign in');

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

function getWebAppUrl() {
  const base = process.env.PUBLIC_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/telegram-app.html` : null;
}

function sendOpenAppButton(chatId, text = 'Tap below to open Whisper.') {
  const webAppUrl = getWebAppUrl();
  if (!bot) return;

  if (!webAppUrl) {
    bot.sendMessage(chatId, text + '\n\n(Mini App URL not configured yet - set PUBLIC_BASE_URL.)');
    return;
  }

  bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [[{ text: '👂 Open Whisper', web_app: { url: webAppUrl } }]],
    },
  });
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
