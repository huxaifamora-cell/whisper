const db = require('../db');
const telegram = require('./telegramBot');
const fcm = require('./fcm');
const { labelForSymbol } = require('../constants/symbols');

async function dispatchAlert(rule, price) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [rule.user_id]);
  const user = rows[0];
  if (!user) return;

  let dispatchedTelegram = false;
  let dispatchedFcm = false;

  if (user.telegram_chat_id) {
    const arrow = rule.direction === 'buy' ? '📈' : '📉';
    const text =
      `${arrow} WHISPER ALERT\n` +
      `${labelForSymbol(rule.symbol)} (${rule.timeframe})\n` +
      `Target ${rule.target_price} reached — price now ${price}\n` +
      `Direction: ${rule.direction.toUpperCase()}\n\n` +
      `Time to check your chart 👀`;
    await telegram.sendAlertToChat(user.telegram_chat_id, text);
    dispatchedTelegram = true;
  }

  const fcmResult = await fcm.sendAlertToUser(user.id, {
    symbol: rule.symbol,
    timeframe: rule.timeframe,
    direction: rule.direction,
    target_price: rule.target_price,
    price,
    sound: rule.sound,
    rule_id: rule.id,
  });
  dispatchedFcm = fcmResult.sent > 0;

  await db.query(
    `INSERT INTO alert_history (rule_id, user_id, symbol, price, direction, dispatched_telegram, dispatched_fcm)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [rule.id, user.id, rule.symbol, price, rule.direction, dispatchedTelegram, dispatchedFcm]
  );

  console.log(`[dispatch] rule #${rule.id} (${rule.symbol}) fired @ ${price} -> telegram=${dispatchedTelegram} fcm=${dispatchedFcm}`);
}

module.exports = { dispatchAlert };
