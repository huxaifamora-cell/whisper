// Visit this in a browser once your backend is deployed:
//   https://<your-render-url>/admin/discover-symbols?secret=YOUR_MT5_BRIDGE_SECRET
//
// It asks Deriv directly which volatility symbols its WS API actually
// streams and shows them as a simple readable page - no terminal, no local
// Node install needed. Reuses MT5_BRIDGE_SECRET as the access key so there's
// one less secret to manage.

const express = require('express');
const WebSocket = require('ws');

const router = express.Router();

router.get('/discover-symbols', async (req, res) => {
  if (!process.env.MT5_BRIDGE_SECRET || req.query.secret !== process.env.MT5_BRIDGE_SECRET) {
    return res.status(401).send('Missing or wrong ?secret= value.');
  }

  try {
    const results = await new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `${process.env.DERIV_WS_URL}?app_id=${process.env.DERIV_APP_ID}`
      );
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out waiting for Deriv'));
      }, 10000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ active_symbols: 'brief', product_type: 'basic' }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.error) {
          clearTimeout(timeout);
          ws.close();
          return reject(new Error(msg.error.message));
        }
        if (msg.msg_type === 'active_symbols') {
          clearTimeout(timeout);
          const volatility = msg.active_symbols
            .filter((s) => /volatility/i.test(s.display_name))
            .sort((a, b) => a.display_name.localeCompare(b.display_name));
          ws.close();
          resolve(volatility);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const rows = results
      .map((s) => `<tr><td style="padding:4px 12px">${s.symbol}</td><td style="padding:4px 12px">${s.display_name}</td></tr>`)
      .join('');

    res.send(`
      <html><body style="font-family:sans-serif;background:#0a0a0f;color:#eee;padding:24px">
        <h2>Volatility symbols Deriv's WS API actually streams</h2>
        <p>Anything from your target list NOT in this table isn't available over this API and needs the MT5 bridge instead.</p>
        <table style="border-collapse:collapse"><tr><th style="text-align:left;padding:4px 12px">Code</th><th style="text-align:left;padding:4px 12px">Display name</th></tr>${rows}</table>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('Error contacting Deriv: ' + err.message);
  }
});

module.exports = router;
