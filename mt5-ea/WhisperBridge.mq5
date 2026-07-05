//+------------------------------------------------------------------+
//|                                              WhisperBridge.mq5   |
//|  ONE EA instance watches EVERY volatility symbol and pushes      |
//|  their prices to the Whisper backend - so all your alerts run    |
//|  off one consistent MT5 feed, regardless of whether Deriv's WS   |
//|  API also happens to stream that symbol.                         |
//|                                                                    |
//|  SETUP (all one-time steps):                                     |
//|  1. Attach this EA to ANY chart in MT5 (it doesn't matter which  |
//|     - it monitors the symbol list below regardless of which      |
//|     chart it's sitting on).                                      |
//|  2. Edit the SymbolMap input if your broker names any symbol     |
//|     differently (defaults already cover all 17 volatility        |
//|     symbols - standard, 1s, and the MT5-only 150/250 variants).  |
//|  3. Set ServerUrl to your Render backend + /ticks/mt5             |
//|  4. Set ApiSecret to match MT5_BRIDGE_SECRET in Render.           |
//|  5. Tools -> Options -> Expert Advisors -> tick "Allow WebRequest |
//|     for listed URL" and add your Render domain.                  |
//|  6. Enable AutoTrading (top toolbar) - the EA won't send          |
//|     anything otherwise.                                          |
//|                                                                    |
//|  That's it - this single EA now covers every symbol listed in    |
//|  SymbolMap, forever, without opening their charts.                |
//+------------------------------------------------------------------+
#property copyright "Whisper"
#property version   "2.00"
#property strict

// Format: "MT5 broker symbol name:Whisper code, MT5 broker symbol name:Whisper code, ..."
// If your broker names these symbols slightly differently (check MT5's
// Market Watch -> right-click -> Symbols to see exact names), just edit the
// left side of each pair here - the right side must match a key in
// backend/src/constants/symbols.js. This covers every volatility symbol,
// not just the ones missing from Deriv's WS API - one EA, one feed, no need
// to think about which source covers which symbol.
input string SymbolMap =
   "Volatility 10 Index:R_10,"
   "Volatility 25 Index:R_25,"
   "Volatility 50 Index:R_50,"
   "Volatility 75 Index:R_75,"
   "Volatility 100 Index:R_100,"
   "Volatility 10 (1s) Index:1HZ10V,"
   "Volatility 15 (1s) Index:1HZ15V,"
   "Volatility 25 (1s) Index:1HZ25V,"
   "Volatility 30 (1s) Index:1HZ30V,"
   "Volatility 50 (1s) Index:1HZ50V,"
   "Volatility 75 (1s) Index:1HZ75V,"
   "Volatility 90 (1s) Index:1HZ90V,"
   "Volatility 100 (1s) Index:1HZ100V,"
   "Volatility 5 Index:MT5_VOL5,"
   "Volatility 15 Index:MT5_VOL15,"
   "Volatility 30 Index:MT5_VOL30,"
   "Volatility 90 Index:MT5_VOL90,"
   "Volatility 5 (1s) Index:MT5_VOL5_1S,"
   "Volatility 150 (1s) Index:MT5_VOL150_1S,"
   "Volatility 250 (1s) Index:MT5_VOL250_1S";

input string ServerUrl         = "https://whisper-backend.onrender.com/ticks/mt5";
input string ApiSecret         = "PASTE_YOUR_MT5_BRIDGE_SECRET_HERE";
input int    CheckIntervalMs   = 1000;   // how often to check all symbols for a price change

string mt5Names[];
string whisperCodes[];
double lastSentPrice[];

int OnInit()
  {
   ParseSymbolMap();

   for(int i = 0; i < ArraySize(mt5Names); i++)
     {
      if(!SymbolSelect(mt5Names[i], true))
         Print("WhisperBridge WARNING: couldn't find symbol '", mt5Names[i],
               "' in Market Watch - check the exact name with your broker.");
     }

   EventSetMillisecondTimer(CheckIntervalMs);
   Print("WhisperBridge started, watching ", ArraySize(mt5Names), " symbol(s).");
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

void OnTimer()
  {
   for(int i = 0; i < ArraySize(mt5Names); i++)
     {
      double price = SymbolInfoDouble(mt5Names[i], SYMBOL_BID);
      if(price <= 0) continue;
      if(price == lastSentPrice[i]) continue;

      lastSentPrice[i] = price;
      SendPrice(whisperCodes[i], price);
     }
  }

void SendPrice(string whisperCode, double price)
  {
   string json = StringFormat("{\"symbol\":\"%s\",\"price\":%.5f}", whisperCode, price);

   char postData[];
   StringToCharArray(json, postData, 0, StringLen(json));

   char result[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\nX-Whisper-Secret: " + ApiSecret + "\r\n";

   int status = WebRequest("POST", ServerUrl, headers, 5000, postData, result, resultHeaders);

   if(status == -1)
     {
      int err = GetLastError();
      if(err == 4060)
         Print("WhisperBridge error: WebRequest URL not allowed. Add ", ServerUrl,
               " in Tools > Options > Expert Advisors.");
      else
         Print("WhisperBridge WebRequest failed for ", whisperCode, ", error code: ", err);
     }
   else if(status != 200)
     {
      Print("WhisperBridge: server responded ", status, " for ", whisperCode, " - ", CharArrayToString(result));
     }
  }

// Splits the SymbolMap input into parallel mt5Names[] / whisperCodes[] arrays.
void ParseSymbolMap()
  {
   string pairs[];
   int pairCount = StringSplit(SymbolMap, ',', pairs);

   ArrayResize(mt5Names, pairCount);
   ArrayResize(whisperCodes, pairCount);
   ArrayResize(lastSentPrice, pairCount);

   for(int i = 0; i < pairCount; i++)
     {
      string parts[];
      int n = StringSplit(pairs[i], ':', parts);
      if(n == 2)
        {
         mt5Names[i]   = TrimStr(parts[0]);
         whisperCodes[i] = TrimStr(parts[1]);
        }
      lastSentPrice[i] = 0;
     }
  }

string TrimStr(string s)
  {
   StringTrimLeft(s);
   StringTrimRight(s);
   return s;
  }
//+------------------------------------------------------------------+
