// Connects to Deriv's public WebSocket API and subscribes to ticks for every
// symbol that currently has at least one active rule. Reconnects automatically.

const WebSocket = require('ws');
const db = require('../db');
const { evaluateTick } = require('./rulesEngine');
const { MT5_BRIDGE_ONLY } = require('../constants/symbols');

let ws = null;
let subscribedSymbols = new Set();
let reconnectDelayMs = 1000;
const MAX_RECONNECT_DELAY = 30000;

function connect() {
  const url = `${process.env.DERIV_WS_URL}?app_id=${process.env.DERIV_APP_ID}`;
  ws = new WebSocket(url);

  ws.on('open', async () => {
    console.log('[deriv] connected');
    reconnectDelayMs = 1000;
    await refreshSubscriptions(); // subscribe to whatever symbols already have rules
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.msg_type === 'tick' && msg.tick) {
      const { symbol, quote } = msg.tick;
      evaluateTick(symbol, Number(quote)).catch((err) =>
        console.error('[rulesEngine] evaluateTick error:', err.message)
      );
    }

    if (msg.error) {
      console.error('[deriv] API error:', msg.error.message);
    }
  });

  ws.on('close', () => {
    console.warn('[deriv] connection closed, reconnecting in', reconnectDelayMs, 'ms');
    subscribedSymbols = new Set(); // force re-subscribe after reconnect
    setTimeout(connect, reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY);
  });

  ws.on('error', (err) => {
    console.error('[deriv] socket error:', err.message);
  });
}

// Re-reads the set of distinct symbols with an active rule and subscribes to
// any new ones. Call this after a rule is created/deleted/status-changed.
async function refreshSubscriptions() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const result = await db.query(
    `SELECT DISTINCT symbol FROM rules WHERE status = 'active'`
  );
  const neededSymbols = new Set(
    result.rows.map((r) => r.symbol).filter((s) => !MT5_BRIDGE_ONLY.has(s))
  );

  for (const symbol of neededSymbols) {
    if (!subscribedSymbols.has(symbol)) {
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      subscribedSymbols.add(symbol);
      console.log('[deriv] subscribed to', symbol);
    }
  }
  // Note: Deriv ticks subscriptions are cheap to leave open even if a symbol's
  // last rule is later disabled; a full forget/unsubscribe pass can be added
  // later if you want to trim idle subscriptions.
}

function start() {
  connect();
}

module.exports = { start, refreshSubscriptions };
