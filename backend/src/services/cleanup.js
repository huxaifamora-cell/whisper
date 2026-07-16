const db = require('../db');
const { VALID_SYMBOLS } = require('../constants/symbols');

// Runs once at boot. Finds any "active" rule whose symbol isn't one of our
// known-good Deriv codes (leftover from before symbol validation existed,
// or from manual DB edits) and disables it, so the Deriv WS client never
// tries to subscribe to it again. Nothing is deleted - just flipped to
// 'disabled' so the user can still see it and fix/remove it from the
// dashboard if they want.
async function disableInvalidSymbolRules() {
  const { rows } = await db.query(`SELECT id, symbol FROM rules WHERE status = 'active'`);
  const badRows = rows.filter((r) => !VALID_SYMBOLS.has(String(r.symbol)));

  if (!badRows.length) {
    console.log('[cleanup] no invalid-symbol rules found');
    return;
  }

  const ids = badRows.map((r) => r.id);
  await db.query(`UPDATE rules SET status = 'disabled' WHERE id = ANY($1::int[])`, [ids]);

  console.warn(
    `[cleanup] disabled ${badRows.length} rule(s) with invalid symbols:`,
    badRows.map((r) => `#${r.id} "${r.symbol}"`).join(', ')
  );
}

module.exports = { disableInvalidSymbolRules };
