//+------------------------------------------------------------------+
//|                                        WhisperListSymbols.mq5    |
//|  Run this ONCE as a Script (not an EA) to see the exact symbol   |
//|  names your broker uses for every volatility instrument.         |
//|                                                                    |
//|  HOW TO RUN:                                                      |
//|  1. In MT5's Navigator panel, under "Scripts", find               |
//|     WhisperListSymbols and double-click it (or drag onto any     |
//|     chart). It runs once and finishes immediately.                |
//|  2. Open the "Toolbox" panel -> "Experts" tab to see the output. |
//|  3. Copy everything it printed and send it back - that's the     |
//|     exact, confirmed list of symbol names for your broker, no    |
//|     guessing needed on either side.                               |
//+------------------------------------------------------------------+
#property copyright "Whisper"
#property version   "1.00"
#property script_show_inputs

void OnStart()
  {
   int total = SymbolsTotal(false); // false = every symbol the broker offers, not just Market Watch
   int found = 0;

   Print("=== WhisperListSymbols: scanning ", total, " symbols for your broker ===");

   for(int i = 0; i < total; i++)
     {
      string name = SymbolName(i, false);
      if(StringFind(name, "olatilit") >= 0 || StringFind(name, "VOLATIL") >= 0 ||
         StringFind(name, "olatility") >= 0)
        {
         found++;
         Print(found, ". ", name);
        }
     }

   if(found == 0)
     {
      // Fallback: some brokers use different naming (e.g. "VIX10", "V10")
      // instead of "Volatility" - print everything so it can be checked by eye.
      Print("No symbols matched 'Volatility' - printing full symbol list instead so you can spot them:");
      for(int i = 0; i < total; i++)
         Print(i, ". ", SymbolName(i, false));
     }

   Print("=== Done. Copy everything above and send it back. ===");
  }
//+------------------------------------------------------------------+
