// Run this once, locally, with internet access:
//   cd backend && node scripts/discover-symbols.js
//
// It asks Deriv directly (active_symbols) for every symbol it currently
// streams, and prints anything with "Volatility" in the name along with its
// exact symbol code. This replaces guessing: whatever ISN'T in this printed
// list is a symbol Deriv doesn't expose over the public WS ticks API at all
// (i.e. it's MT5-only, and needs the EA bridge instead).

const WebSocket = require('ws');

const APP_ID = process.env.DERIV_APP_ID || '1089';
const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);

ws.on('open', () => {
  ws.send(JSON.stringify({ active_symbols: 'brief', product_type: 'basic' }));
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());

  if (msg.error) {
    console.error('API error:', msg.error.message);
    process.exit(1);
  }

  if (msg.msg_type === 'active_symbols') {
    const volatilitySymbols = msg.active_symbols.filter((s) =>
      /volatility/i.test(s.display_name)
    );

    console.log(`Found ${volatilitySymbols.length} volatility-related symbols streamed by Deriv's WS API:\n`);
    volatilitySymbols
      .sort((a, b) => a.display_name.localeCompare(b.display_name))
      .forEach((s) => {
        console.log(`  ${s.symbol.padEnd(12)} -> ${s.display_name}`);
      });

    console.log('\nAnything from your target list NOT printed above is not available over this WS API');
    console.log('(app_id ' + APP_ID + ') and needs the MT5 EA bridge instead.');

    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
