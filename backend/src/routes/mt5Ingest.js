// The MT5 EA (mt5-ea/WhisperBridge.mq5) pushes a price here every time it
// changes on the chart it's attached to. This lets any symbol that only
// exists on MT5 (not on Deriv's public WS ticks API) still trigger alerts
// through the exact same crossing-detection logic in rulesEngine.js.
//
// Auth is a shared secret (not a user JWT) since an MQL5 WebRequest call
// can't easily do OAuth/JWT refresh - the EA just sends a fixed header.

const express = require('express');
const { evaluateTick } = require('../services/rulesEngine');
const { isValidSymbol } = require('../constants/symbols');

const router = express.Router();

router.post('/', async (req, res) => {
  const secret = req.headers['x-whisper-secret'];
  if (!process.env.MT5_BRIDGE_SECRET || secret !== process.env.MT5_BRIDGE_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing bridge secret' });
  }

  const { symbol, price } = req.body;
  if (!symbol || price == null || isNaN(Number(price))) {
    return res.status(400).json({ error: 'symbol and numeric price are required' });
  }
  if (!isValidSymbol(symbol)) {
    return res.status(400).json({ error: `Unknown symbol "${symbol}". Add it to constants/symbols.js first.` });
  }

  await evaluateTick(symbol.toUpperCase(), Number(price));
  res.json({ ok: true });
});

module.exports = router;
