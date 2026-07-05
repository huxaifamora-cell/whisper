// Whisper dashboard - talks to the backend REST API.
// Same-origin by default (the backend serves this file), so no base URL needed.
// If you host the dashboard separately, set API_BASE to the backend's full URL.
const API_BASE = '';

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
};
function labelForSymbol(symbol) {
  return SYMBOL_LABELS[String(symbol).toUpperCase()] || symbol;
}

let token = localStorage.getItem('whisper_token');
let currentUser = JSON.parse(localStorage.getItem('whisper_user') || 'null');

const $ = (id) => document.getElementById(id);

function api(path, opts = {}) {
  return fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

function showApp() {
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('accountBox').classList.remove('hidden');
  $('pairingCodeLabel').textContent = currentUser.email;
  $('pairingCode').textContent = currentUser.pairing_code;
  $('pairingInline').textContent = currentUser.pairing_code;
  loadRules();
  loadHistory();
}

function showAuth() {
  $('authView').classList.remove('hidden');
  $('appView').classList.add('hidden');
  $('accountBox').classList.add('hidden');
}

// ---- tabs ----
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    $('loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
    $('registerForm').classList.toggle('hidden', tab.dataset.tab !== 'register');
  });
});

// ---- auth ----
function handleAuthSuccess(data) {
  token = data.token;
  currentUser = data.user;
  localStorage.setItem('whisper_token', token);
  localStorage.setItem('whisper_user', JSON.stringify(currentUser));
  showApp();
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('authError').classList.add('hidden');
  const fd = new FormData(e.target);
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    handleAuthSuccess(data);
  } catch (err) {
    $('authError').textContent = err.message;
    $('authError').classList.remove('hidden');
  }
});

$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('authError').classList.add('hidden');
  const fd = new FormData(e.target);
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    handleAuthSuccess(data);
  } catch (err) {
    $('authError').textContent = err.message;
    $('authError').classList.remove('hidden');
  }
});

$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('whisper_token');
  localStorage.removeItem('whisper_user');
  token = null;
  currentUser = null;
  showAuth();
});

// ---- rules ----
$('ruleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('/rules', {
    method: 'POST',
    body: JSON.stringify({
      symbol: fd.get('symbol'),
      timeframe: fd.get('timeframe'),
      target_price: Number(fd.get('target_price')),
      direction: fd.get('direction'),
      sound: fd.get('sound'),
    }),
  });
  e.target.reset();
  loadRules();
});

async function loadRules() {
  const rules = await api('/rules');
  $('rulesBody').innerHTML = rules
    .map(
      (r) => `
    <tr>
      <td>${labelForSymbol(r.symbol)}</td>
      <td>${r.timeframe}</td>
      <td>${r.target_price}</td>
      <td>${r.direction}</td>
      <td class="status-${r.status}">${r.status}</td>
      <td><button class="link-btn" data-id="${r.id}">Delete</button></td>
    </tr>`
    )
    .join('');

  $('rulesBody').querySelectorAll('.link-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/rules/${btn.dataset.id}`, { method: 'DELETE' });
      loadRules();
    });
  });
}

async function loadHistory() {
  const history = await api('/rules/history/log');
  $('historyBody').innerHTML = history
    .map(
      (h) => `
    <tr>
      <td>${labelForSymbol(h.symbol)}</td>
      <td>${h.price}</td>
      <td>${h.direction}</td>
      <td>${[h.dispatched_telegram ? 'Telegram' : null, h.dispatched_fcm ? 'App' : null].filter(Boolean).join(' + ') || '—'}</td>
      <td>${new Date(h.created_at).toLocaleString()}</td>
    </tr>`
    )
    .join('');
}

$('refreshBtn').addEventListener('click', () => {
  loadRules();
  loadHistory();
});

// ---- boot ----
if (token && currentUser) {
  showApp();
} else {
  showAuth();
}
