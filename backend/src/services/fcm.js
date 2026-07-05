const admin = require('firebase-admin');
const db = require('../db');

let initialized = false;

function init() {
  if (initialized) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT_JSON not set - push notifications disabled');
    return;
  }
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
  console.log('[fcm] initialized');
}

// Sends a DATA-ONLY message (no "notification" block). This is deliberate:
// a data message always wakes the Android app's FirebaseMessagingService,
// even in the background, so the app itself decides how to play the sound /
// show the full-screen alarm-style alert, rather than the OS showing a
// silent default notification.
async function sendAlertToUser(userId, payload) {
  if (!initialized) return { sent: 0 };

  const { rows: devices } = await db.query('SELECT fcm_token FROM devices WHERE user_id = $1', [userId]);
  if (!devices.length) return { sent: 0 };

  const tokens = devices.map((d) => d.fcm_token);
  const message = {
    tokens,
    data: {
      type: 'PRICE_ALERT',
      symbol: String(payload.symbol),
      timeframe: String(payload.timeframe),
      direction: String(payload.direction),
      target_price: String(payload.target_price),
      price: String(payload.price),
      sound: String(payload.sound || 'default'),
      rule_id: String(payload.rule_id),
    },
    android: { priority: 'high' },
  };

  const result = await admin.messaging().sendEachForMulticast(message);

  // Clean up tokens that are no longer valid (app uninstalled, etc.)
  result.responses.forEach((r, i) => {
    if (!r.success && r.error && r.error.code === 'messaging/registration-token-not-registered') {
      db.query('DELETE FROM devices WHERE fcm_token = $1', [tokens[i]]).catch(() => {});
    }
  });

  return { sent: result.successCount };
}

module.exports = { init, sendAlertToUser };
