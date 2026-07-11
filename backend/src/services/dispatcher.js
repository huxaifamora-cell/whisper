const db = require('../db');
const telegram = require('./telegramBot');
const fcm = require('./fcm');
const { labelForSymbol } = require('../constants/symbols');

async function dispatchAlert(rule, price) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [rule.user_id]);
  const owner = rows[0];
  if (!owner) return;

  // The owner always gets it; approved subscribers get a copy too.
  const { rows: subscriberRows } = await db.query(
    `SELECT u.* FROM subscriptions s JOIN users u ON u.id = s.subscriber_user_id
     WHERE s.owner_user_id = $1 AND s.status = 'approved'`,
    [rule.user_id]
  );
  const recipients = [owner, ...subscriberRows];

  let dispatchedTelegram = false;
  let dispatchedFcm = false;

  for (const recipient of recipients) {
    const isOwner = recipient.id === owner.id;
    if (recipient.telegram_chat_id) {
      const arrow = rule.direction === 'buy' ? '📈' : '📉';
      const sharedNote = isOwner ? '' : `\n(shared by ${owner.email})`;
      const text =
        `${arrow} WHISPER ALERT\n` +
        `${labelForSymbol(rule.symbol)} (${rule.timeframe})\n` +
        `Target ${rule.target_price} reached — price now ${price}\n` +
        `Direction: ${rule.direction.toUpperCase()}${sharedNote}\n\n` +
        `Time to check your chart 👀`;
      await telegram.sendAlertToChat(recipient.telegram_chat_id, text);
      if (isOwner) dispatchedTelegram = true;
    }

    const fcmResult = await fcm.sendAlertToUser(recipient.id, {
      symbol: rule.symbol,
      timeframe: rule.timeframe,
      direction: rule.direction,
      target_price: rule.target_price,
      price,
      sound: rule.sound,
      rule_id: rule.id,
    });
    if (isOwner) dispatchedFcm = fcmResult.sent > 0;
  }

  await db.query(
    `INSERT INTO alert_history (rule_id, user_id, symbol, price, direction, dispatched_telegram, dispatched_fcm)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [rule.id, owner.id, rule.symbol, price, rule.direction, dispatchedTelegram, dispatchedFcm]
  );

  console.log(`[dispatch] rule #${rule.id} (${rule.symbol}) fired @ ${price} -> telegram=${dispatchedTelegram} fcm=${dispatchedFcm}`);
}

module.exports = { dispatchAlert };
