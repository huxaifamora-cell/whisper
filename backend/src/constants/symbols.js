// Single source of truth for which symbol codes we accept, and how to show
// them to a human. Deriv's WS API only understands the short codes (R_75,
// 1HZ100V, etc.) but nobody wants to read those in a Telegram message or a
// dashboard table, so every code maps to a friendly label too.
//
// NOTE: 1HZ150V and 1HZ250V were removed after live testing confirmed Deriv's
// WS ticks endpoint rejects them ("Symbol ... is invalid") even though
// Volatility 150/250 (1s) exist on MT5. If Deriv adds WS support for them
// later, re-add here with the confirmed code.

const SYMBOL_LABELS = {
  // Standard 2-second tick — available directly over Deriv's WS ticks API
  R_10: 'Volatility 10 Index',
  R_25: 'Volatility 25 Index',
  R_50: 'Volatility 50 Index',
  R_75: 'Volatility 75 Index',
  R_100: 'Volatility 100 Index',
  // 1-second tick — available directly over Deriv's WS ticks API
  '1HZ5V': 'Volatility 5 (1s) Index', // unconfirmed - not yet live-tested, watch logs after deploy
  '1HZ10V': 'Volatility 10 (1s) Index',
  '1HZ15V': 'Volatility 15 (1s) Index',
  '1HZ25V': 'Volatility 25 (1s) Index',
  '1HZ30V': 'Volatility 30 (1s) Index',
  '1HZ50V': 'Volatility 50 (1s) Index',
  '1HZ75V': 'Volatility 75 (1s) Index',
  '1HZ90V': 'Volatility 90 (1s) Index',
  '1HZ100V': 'Volatility 100 (1s) Index',
  // MT5-bridge-only — Deriv's public WS ticks API rejected these
  // (confirmed live: "Symbol 1HZ150V is invalid" / "Symbol 1HZ250V is invalid").
  // These use OUR OWN internal codes (prefixed MT5_) rather than a guessed
  // Deriv code, and are fed in by the MQL5 EA in mt5-ea/ instead of the
  // Deriv WS client. Run backend/scripts/discover-symbols.js to check
  // whether Deriv has since added real WS support for these - if so, swap
  // the key below for the real Deriv code and remove the EA dependency.
  MT5_VOL150: 'Volatility 150 Index',
  MT5_VOL150_1S: 'Volatility 150 (1s) Index',
  MT5_VOL250: 'Volatility 250 Index',
  MT5_VOL250_1S: 'Volatility 250 (1s) Index',
};

// Which symbols require the MT5 EA bridge rather than the Deriv WS client.
const MT5_BRIDGE_ONLY = new Set(['MT5_VOL150', 'MT5_VOL150_1S', 'MT5_VOL250', 'MT5_VOL250_1S']);

const VALID_SYMBOLS = new Set(Object.keys(SYMBOL_LABELS));

function isValidSymbol(symbol) {
  return typeof symbol === 'string' && VALID_SYMBOLS.has(symbol.toUpperCase());
}

function labelForSymbol(symbol) {
  return SYMBOL_LABELS[String(symbol).toUpperCase()] || symbol;
}

module.exports = { VALID_SYMBOLS, SYMBOL_LABELS, isValidSymbol, labelForSymbol };

