// index.html only: auth (login/register), create alert, upcoming alerts list.
// Shared helpers (api, whisperToken, labelForSymbol, etc.) come from common.js.

let token = localStorage.getItem('whisper_token');
let currentUser = JSON.parse(localStorage.getItem('whisper_user') || 'null');

const $ = (id) => document.getElementById(id);

function showApp() {
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('accountBox').classList.remove('hidden');
  $('navLinks').classList.remove('hidden');
  loadRules();
}

function showAuth() {
  $('authView').classList.remove('hidden');
  $('appView').classList.add('hidden');
  $('accountBox').classList.add('hidden');
  $('navLinks').classList.add('hidden');
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
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
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
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    handleAuthSuccess(data);
  } catch (err) {
    $('authError').textContent = err.message;
    $('authError').classList.remove('hidden');
  }
});

$('logoutBtn').addEventListener('click', whisperLogout);

// ---- rules ----
$('ruleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const statusEl = $('createStatus');
  statusEl.textContent = 'Creating…';
  statusEl.className = 'sub';

  try {
    await api('/rules', {
      method: 'POST',
      body: JSON.stringify({
        symbol: fd.get('symbol'),
        timeframe: fd.get('timeframe'),
        target_price: Number(fd.get('target_price')),
        direction: fd.get('direction'),
        sound: fd.get('sound'),
        description: fd.get('description') || null,
      }),
    });
    e.target.reset();
    statusEl.textContent = '✅ Alert created — you\'ll be notified when it triggers.';
    statusEl.style.color = 'var(--success)';
    loadRules();
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = 'var(--danger)';
  }
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
      <td>${r.description ? r.description : '—'}</td>
      <td class="status-${r.status}">${r.status}</td>
      <td>${new Date(r.created_at).toLocaleString()}</td>
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

$('refreshBtn').addEventListener('click', loadRules);

// ---- boot ----
if (token && currentUser) {
  showApp();
} else {
  showAuth();
}
