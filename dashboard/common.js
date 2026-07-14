// Shared across every dashboard page. Include this before any page-specific script.
const API_BASE = '';

function whisperToken() {
  return localStorage.getItem('whisper_token');
}

function requireAuthOrRedirect() {
  if (!whisperToken()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function api(path, opts = {}) {
  return fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${whisperToken()}`,
      ...(opts.headers || {}),
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

function whisperLogout() {
  localStorage.removeItem('whisper_token');
  localStorage.removeItem('whisper_user');
  window.location.href = 'index.html';
}

// Mirrors backend/src/constants/symbols.js SYMBOL_LABELS - keep in sync.
const SYMBOL_LABELS = {
  R_10: 'Volatility 10 Index',
  R_25: 'Volatility 25 Index',
  R_50: 'Volatility 50 Index',
  R_75: 'Volatility 75 Index',
  R_100: 'Volatility 100 Index',
  '1HZ10V': 'Volatility 10 (1s) Index',
  '1HZ15V': 'Volatility 15 (1s) Index',
  '1HZ25V': 'Volatility 25 (1s) Index',
  '1HZ30V': 'Volatility 30 (1s) Index',
  '1HZ50V': 'Volatility 50 (1s) Index',
  '1HZ75V': 'Volatility 75 (1s) Index',
  '1HZ90V': 'Volatility 90 (1s) Index',
  '1HZ100V': 'Volatility 100 (1s) Index',
  MT5_VOL5: 'Volatility 5 Index (MT5 bridge)',
  MT5_VOL15: 'Volatility 15 Index (MT5 bridge)',
  MT5_VOL30: 'Volatility 30 Index (MT5 bridge)',
  MT5_VOL90: 'Volatility 90 Index (MT5 bridge)',
  MT5_VOL5_1S: 'Volatility 5 (1s) Index (MT5 bridge)',
  MT5_VOL150_1S: 'Volatility 150 (1s) Index (MT5 bridge)',
  MT5_VOL250_1S: 'Volatility 250 (1s) Index (MT5 bridge)',
  frxXAUUSD: 'XAUUSD',
  cryBTCUSD: 'Bitcoin/USD (BTCUSD)',
  frxGBPUSD: 'GBP/USD',
  frxAUDUSD: 'AUD/USD',
  frxEURUSD: 'EUR/USD',
  frxGBPJPY: 'GBP/JPY',
  frxUSDCAD: 'USD/CAD',
  frxUSDJPY: 'USD/JPY',
  frxEURAUD: 'EUR/AUD',
  frxAUDCHF: 'AUD/CHF',
  frxUSDCHF: 'USD/CHF',
};
function labelForSymbol(symbol) {
  return SYMBOL_LABELS[String(symbol).toUpperCase()] || symbol;
}
