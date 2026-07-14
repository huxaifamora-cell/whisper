// Telegram Mini App logic. Relies on common.js for api()/labelForSymbol().
// Auth is different from the regular dashboard: no manual token entry -
// Telegram's initData proves who you are, and the backend either auto-logs
// you in (if already linked) or asks you to sign in once to link this chat.

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#07070b');
  tg.setBackgroundColor('#07070b');
}

const $ = (id) => document.getElementById(id);
let miniAppToken = localStorage.getItem('whisper_tg_token');

function tgApi(path, opts = {}) {
  return fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(miniAppToken ? { Authorization: `Bearer ${miniAppToken}` } : {}),
      ...(opts.headers || {}),
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

// ---- boot: check if this Telegram chat is already linked ----
async function boot() {
  const initData = tg?.initData || '';

  if (!initData) {
    // Not actually opened from inside Telegram (e.g. testing in a plain
    // browser) - nothing we can verify, so just show the login form.
    showLogin();
    return;
  }

  try {
    const result = await tgApi('/telegram-webapp/session', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });

    if (result.linked) {
      miniAppToken = result.token;
      localStorage.setItem('whisper_tg_token', miniAppToken);
      showApp();
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin();
  }
}

function showLogin() {
  $('loginView').classList.remove('hidden');
  $('tabbar').classList.add('hidden');
}

function showApp() {
  $('loginView').classList.add('hidden');
  $('tabbar').classList.remove('hidden');
  populateSelects();
  switchView('alertsView');
  loadRules();
}

// ---- login / register, then link this Telegram chat ----
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    $('loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
    $('registerForm').classList.toggle('hidden', tab.dataset.tab !== 'register');
  });
});

async function handleAuth(endpoint, email, password) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed');

  miniAppToken = data.token;
  localStorage.setItem('whisper_tg_token', miniAppToken);

  // Now link this verified Telegram chat to the account we just authenticated as.
  await tgApi('/telegram-webapp/link', {
    method: 'POST',
    body: JSON.stringify({ initData: tg.initData }),
  });

  showApp();
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('authError').classList.add('hidden');
  const fd = new FormData(e.target);
  try {
    await handleAuth('/auth/login', fd.get('email'), fd.get('password'));
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
    await handleAuth('/auth/register', fd.get('email'), fd.get('password'));
  } catch (err) {
    $('authError').textContent = err.message;
    $('authError').classList.remove('hidden');
  }
});

// ---- tab navigation ----
function switchView(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $(viewId).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewId));

  if (viewId === 'historyView') loadHistory();
  if (viewId === 'sharedView') { loadIncoming(); loadOutgoing(); }
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ---- populate symbol/timeframe selects (mirrors index.html's options) ----
function populateSelects() {
  const symbols = Object.entries(SYMBOL_LABELS);
  $('symbolSelect').innerHTML =
    '<option value="" disabled selected>Select symbol…</option>' +
    symbols.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');

  const timeframes = ['M1','M5','M10','M15','M30','H1','H2','H4','H6','H12','D1','W1','MN1'];
  $('timeframeSelect').innerHTML =
    '<option value="" disabled selected>Select timeframe…</option>' +
    timeframes.map((t) => `<option value="${t}">${t}</option>`).join('');
}

// ---- alerts ----
async function loadRules() {
  const rules = await tgApi('/rules');
  $('rulesEmpty').classList.toggle('hidden', rules.length > 0);
  $('rulesList').innerHTML = rules.map((r) => `
    <div class="input-background" style="background:#0c0b13;border:1px solid var(--panel-border);border-radius:10px;padding:12px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:600;">${labelForSymbol(r.symbol)}</div>
          <div style="color:var(--text-dim);font-size:0.82rem;">${r.timeframe} → ${r.target_price} (${r.direction})</div>
          ${r.description ? `<div style="color:var(--text-dim);font-size:0.78rem;font-style:italic;margin-top:4px;">"${r.description}"</div>` : ''}
          <div class="status-${r.status}" style="font-size:0.78rem;margin-top:4px;">${r.status}</div>
        </div>
        <button class="link-btn delete-rule" data-id="${r.id}">Delete</button>
      </div>
    </div>`).join('');

  $('rulesList').querySelectorAll('.delete-rule').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await tgApi(`/rules/${btn.dataset.id}`, { method: 'DELETE' });
      loadRules();
    });
  });
}

$('ruleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const statusEl = $('createStatus');
  statusEl.textContent = 'Creating…';
  try {
    await tgApi('/rules', {
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
    statusEl.textContent = '✅ Alert created.';
    statusEl.style.color = 'var(--success)';
    tg?.HapticFeedback?.notificationOccurred('success');
    switchView('alertsView');
    loadRules();
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = 'var(--danger)';
  }
});

// ---- history ----
async function loadHistory() {
  const history = await tgApi('/rules/history/log');
  $('historyList').innerHTML = history.map((h) => `
    <div style="background:#0c0b13;border:1px solid var(--panel-border);border-radius:10px;padding:12px;margin-bottom:8px;">
      <div style="font-weight:600;">${labelForSymbol(h.symbol)}</div>
      <div style="color:var(--text-dim);font-size:0.82rem;">Price ${h.price} (${h.direction})</div>
      ${h.is_shared ? `<div style="color:var(--purple-bright);font-size:0.75rem;">shared by ${h.owner_email}</div>` : ''}
      <div style="color:var(--text-dim);font-size:0.72rem;margin-top:4px;">${new Date(h.created_at).toLocaleString()}</div>
    </div>`).join('') || '<p class="sub">No triggered alerts yet.</p>';
}

// ---- shared alerts ----
$('requestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = $('requestStatus');
  statusEl.textContent = 'Sending…';
  try {
    await tgApi('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ owner_email: $('ownerEmailInput').value }),
    });
    statusEl.textContent = '✅ Request sent.';
    statusEl.style.color = 'var(--success)';
    $('ownerEmailInput').value = '';
    loadOutgoing();
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = 'var(--danger)';
  }
});

async function loadIncoming() {
  const rows = await tgApi('/subscriptions/incoming');
  $('incomingList').innerHTML = rows.map((r) => `
    <div style="background:#0c0b13;border:1px solid var(--panel-border);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div>${r.subscriber_email}</div>
        <div class="status-${r.status === 'approved' ? 'active' : r.status === 'pending' ? 'triggered' : 'disabled'}" style="font-size:0.78rem;">${r.status}</div>
      </div>
      <div>
        ${r.status === 'pending' ? `<button class="link-btn approve-btn" data-id="${r.id}" style="color:var(--success)">Approve</button>` : ''}
        ${r.status !== 'revoked' ? `<button class="link-btn revoke-btn" data-id="${r.id}">Revoke</button>` : ''}
      </div>
    </div>`).join('') || '<p class="sub">None yet.</p>';

  $('incomingList').querySelectorAll('.approve-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await tgApi(`/subscriptions/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
      loadIncoming();
    });
  });
  $('incomingList').querySelectorAll('.revoke-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await tgApi(`/subscriptions/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'revoked' }) });
      loadIncoming();
    });
  });
}

async function loadOutgoing() {
  const rows = await tgApi('/subscriptions/outgoing');
  $('outgoingList').innerHTML = rows.map((r) => `
    <div style="background:#0c0b13;border:1px solid var(--panel-border);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div>${r.owner_email}</div>
        <div class="status-${r.status === 'approved' ? 'active' : r.status === 'pending' ? 'triggered' : 'disabled'}" style="font-size:0.78rem;">${r.status}</div>
      </div>
      ${r.status !== 'revoked' ? `<button class="link-btn cancel-btn" data-id="${r.id}">Cancel</button>` : ''}
    </div>`).join('') || '<p class="sub">None yet.</p>';

  $('outgoingList').querySelectorAll('.cancel-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await tgApi(`/subscriptions/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'revoked' }) });
      loadOutgoing();
    });
  });
}

boot();
