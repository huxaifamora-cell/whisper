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

  // Default: volatility indices (original use case). Pass ?q=xau,btc,gbpusd
  // etc. to search for anything else instead - comma-separated, matched
  // case-insensitively against both the symbol code and display name.
  const searchTerms = req.query.q
    ? String(req.query.q).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : null;

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
          const matched = msg.active_symbols
            .filter((s) => {
              if (searchTerms) {
                const haystack = `${s.symbol} ${s.display_name}`.toLowerCase();
                return searchTerms.some((term) => haystack.includes(term));
              }
              return /volatility/i.test(s.display_name);
            })
            .sort((a, b) => a.display_name.localeCompare(b.display_name));
          ws.close();
          resolve(matched);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const rows = results
      .map((s) => `<tr><td style="padding:4px 12px">${s.symbol}</td><td style="padding:4px 12px">${s.display_name}</td><td style="padding:4px 12px">${s.market}/${s.submarket}</td></tr>`)
      .join('');

    res.send(`
      <html><body style="font-family:sans-serif;background:#0a0a0f;color:#eee;padding:24px">
        <h2>${searchTerms ? `Symbols matching: ${searchTerms.join(', ')}` : "Volatility symbols Deriv's WS API actually streams"}</h2>
        <p>${results.length} match(es) found. Anything you searched for that's NOT in this table isn't available over this WS API and needs a different approach (e.g. the MT5 bridge).</p>
        <table style="border-collapse:collapse"><tr><th style="text-align:left;padding:4px 12px">Code</th><th style="text-align:left;padding:4px 12px">Display name</th><th style="text-align:left;padding:4px 12px">Market</th></tr>${rows}</table>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('Error contacting Deriv: ' + err.message);
  }
});

module.exports = router;
