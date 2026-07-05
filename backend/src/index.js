require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');
const derivClient = require('./services/derivClient');
const telegramBot = require('./services/telegramBot');
const fcm = require('./services/fcm');
const { disableInvalidSymbolRules } = require('./services/cleanup');

const authRoutes = require('./routes/auth');
const rulesRoutes = require('./routes/rules');
const deviceRoutes = require('./routes/devices');
const mt5IngestRoutes = require('./routes/mt5Ingest');
const adminDiscoverRoutes = require('./routes/adminDiscover');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the dashboard static site (built/copied into ../dashboard at deploy time)
app.use(express.static(path.join(__dirname, '..', '..', 'dashboard')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/rules', rulesRoutes);
app.use('/devices', deviceRoutes);
app.use('/ticks/mt5', mt5IngestRoutes);
app.use('/admin', adminDiscoverRoutes);

// Only needed if TELEGRAM_USE_WEBHOOK=true
app.post('/telegram/webhook', (req, res, next) => {
  const handler = telegramBot.getWebhookHandler();
  handler(req, res, next);
});

async function main() {
  await db.initSchema();
  await disableInvalidSymbolRules();
  fcm.init();
  telegramBot.init();
  derivClient.start();

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`[whisper] listening on :${port}`));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
