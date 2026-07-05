// Given a fresh tick, find every active rule for that symbol and check whether
// price just crossed the user's target in the requested direction.
//
// direction "buy"  -> alert when price crosses UP through target (last < target <= price)
// direction "sell" -> alert when price crosses DOWN through target (last > target >= price)
//
// We require an actual crossing (not just "price is above target") so a rule
// created while price is already past the target doesn't fire immediately.

const db = require('../db');
const { dispatchAlert } = require('./dispatcher');

async function evaluateTick(symbol, price) {
  const { rows: rules } = await db.query(
    `SELECT * FROM rules WHERE symbol = $1 AND status = 'active'`,
    [symbol]
  );
  if (!rules.length) return;

  for (const rule of rules) {
    const target = Number(rule.target_price);
    const last = rule.last_price == null ? null : Number(rule.last_price);

    if (last === null) {
      await db.query('UPDATE rules SET last_price = $1 WHERE id = $2', [price, rule.id]);
      continue;
    }

    const crossedUp = rule.direction === 'buy' && last < target && price >= target;
    const crossedDown = rule.direction === 'sell' && last > target && price <= target;

    if (crossedUp || crossedDown) {
      await db.query(
        `UPDATE rules SET status = 'triggered', last_price = $1, triggered_at = now() WHERE id = $2`,
        [price, rule.id]
      );
      await dispatchAlert(rule, price);
    } else {
      await db.query('UPDATE rules SET last_price = $1 WHERE id = $2', [price, rule.id]);
    }
  }
}

module.exports = { evaluateTick };
