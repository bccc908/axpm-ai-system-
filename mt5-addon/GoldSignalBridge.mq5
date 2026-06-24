//+------------------------------------------------------------------+
//|                                         GoldSignalBridge.mq5     |
//| Signal Flag → MT5: poll API, draw levels, alert (optional trade)|
//+------------------------------------------------------------------+
#property copyright "Signal Flag"
#property link      "https://github.com"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

input string InpApiUrl    = "http://127.0.0.1:3000/api/gold-signals/mt5";
input string InpApiKey     = "";           // same as LOCAL_API_KEY in .env.local
input int    InpPollSec    = 30;
input bool   InpDrawLines  = true;
input bool   InpShowAlert  = true;
input bool   InpAutoTrade  = false;        // default OFF — enable only after demo testing
input double InpLots       = 0.01;
input ulong  InpMagic      = 20260617;

string g_lastSignalId = "";
CTrade g_trade;

//--- helpers: minimal JSON string extraction (flat keys inside "alert" object)
string ExtractStr(const string json, const string key)
{
   string pat = "\"" + key + "\":\"";
   int p = StringFind(json, pat);
   if(p < 0) return "";
   p += StringLen(pat);
   int q = StringFind(json, "\"", p);
   if(q < 0) return "";
   return StringSubstr(json, p, q - p);
}

double ExtractNum(const string json, const string key)
{
   string pat = "\"" + key + "\":";
   int p = StringFind(json, pat);
   if(p < 0) return 0;
   p += StringLen(pat);
   string tail = StringSubstr(json, p);
   StringReplace(tail, " ", "");
   int comma = StringFind(tail, ",");
   int brace = StringFind(tail, "}");
   int end = comma;
   if(end < 0 || (brace >= 0 && brace < end)) end = brace;
   if(end < 0) end = StringLen(tail);
   string num = StringSubstr(tail, 0, end);
   return StringToDouble(num);
}

double ExtractZone(const string json, const string zoneKey, const string bound)
{
   int z = StringFind(json, "\"" + zoneKey + "\"");
   if(z < 0) return 0;
   string sub = StringSubstr(json, z, 80);
   return ExtractNum(sub, bound);
}

void DeleteOldLines()
{
   int total = ObjectsTotal(0, 0, OBJ_HLINE);
   for(int i = total - 1; i >= 0; i--)
   {
      string name = ObjectName(0, i, 0, OBJ_HLINE);
      if(StringFind(name, "SF_") == 0)
         ObjectDelete(0, name);
   }
}

void DrawHLine(const string id, const string tag, const double price, const color clr)
{
   if(price <= 0) return;
   string name = "SF_" + id + "_" + tag;
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
   ObjectSetDouble(0, name, OBJPROP_PRICE, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DASH);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetString(0, name, OBJPROP_TEXT, tag);
}

bool PollApi(string &body)
{
   if(StringLen(InpApiKey) < 8)
   {
      Print("GoldSignalBridge: set InpApiKey = LOCAL_API_KEY from Signal Flag .env.local");
      return false;
   }

   char post[];
   char result[];
   ArrayResize(post, 0);
   string headers = "Authorization: Bearer " + InpApiKey + "\r\n";
   string result_headers;

   ResetLastError();
   int code = WebRequest("GET", InpApiUrl, headers, 15000, post, result, result_headers);
   if(code == -1)
   {
      Print("WebRequest failed err=", GetLastError(),
            " — add URL in MT5: Tools → Options → Expert Advisors → Allow WebRequest");
      return false;
   }
   if(code != 200)
   {
      Print("GoldSignalBridge HTTP ", code, " ", result_headers);
      return false;
   }

   body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return true;
}

void PlaceFromSignal(const string json, const string bias)
{
   if(!InpAutoTrade) return;
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("AutoTrade: terminal trading disabled");
      return;
   }
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Print("AutoTrade: enable Algo Trading button");
      return;
   }

   g_trade.SetExpertMagicNumber(InpMagic);
   double entryLo = ExtractZone(json, "entry_zone", "low");
   double entryHi = ExtractZone(json, "entry_zone", "high");
   double entry = (entryLo > 0 && entryHi > 0) ? (entryLo + entryHi) / 2.0 : ExtractNum(json, "entry");
   double stop = ExtractNum(json, "stop");
   double tp1 = 0;
   int tpPos = StringFind(json, "\"targets\":[");
   if(tpPos >= 0)
   {
      string tps = StringSubstr(json, tpPos + 12, 40);
      tp1 = StringToDouble(tps);
   }

   string comment = ExtractStr(json, "order_comment");
   if(StringLen(comment) == 0) comment = "SignalFlag";

   ENUM_ORDER_TYPE type = ORDER_TYPE_BUY;
   if(bias == "short") type = ORDER_TYPE_SELL;
   else if(bias == "long") type = ORDER_TYPE_BUY;
   else return; // neutral / wait — no auto order

   double price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(entry > 0) price = entry;

   if(stop <= 0 || tp1 <= 0)
   {
      Print("AutoTrade: missing stop or TP");
      return;
   }

   if(!g_trade.PositionOpen(_Symbol, type, InpLots, price, stop, tp1, comment))
      Print("Order failed: ", g_trade.ResultRetcode(), " ", g_trade.ResultRetcodeDescription());
   else
      Print("Order placed ", bias, " lot=", InpLots);
}

void HandleSignal()
{
   string body;
   if(!PollApi(body)) return;

   if(StringFind(body, "\"alert\":null") >= 0)
      return;

   int alertPos = StringFind(body, "\"alert\":");
   if(alertPos < 0) return;
   string alertJson = StringSubstr(body, alertPos);

   string sid = ExtractStr(alertJson, "signal_id");
   if(StringLen(sid) == 0 || sid == g_lastSignalId)
      return;

   g_lastSignalId = sid;
   string bias = ExtractStr(alertJson, "bias");
   string msg = ExtractStr(alertJson, "alert");
   int conf = (int)ExtractNum(alertJson, "confidence");

   Print("=== Signal Flag ", bias, " ", conf, "% id=", sid, " ===");
   Print(msg);

   if(InpShowAlert)
      Alert("Signal Flag XAUUSD ", bias, " ", conf, "%\n", msg);

   if(InpDrawLines)
   {
      DeleteOldLines();
      double entryLo = ExtractZone(alertJson, "entry_zone", "low");
      double entryHi = ExtractZone(alertJson, "entry_zone", "high");
      double stop = ExtractNum(alertJson, "stop");
      DrawHLine(sid, "ENTRY_LO", entryLo, clrLime);
      DrawHLine(sid, "ENTRY_HI", entryHi, clrLime);
      DrawHLine(sid, "STOP", stop, clrRed);

      int tpPos = StringFind(alertJson, "\"targets\":[");
      if(tpPos >= 0)
      {
         string rest = StringSubstr(alertJson, tpPos + 12);
         for(int i = 0; i < 3; i++)
         {
            int c = StringFind(rest, ",");
            int b = StringFind(rest, "]");
            int end = (c >= 0 && c < b) ? c : b;
            if(end < 0) break;
            string tpStr = StringSubstr(rest, 0, end);
            double tp = StringToDouble(tpStr);
            DrawHLine(sid, "TP" + IntegerToString(i + 1), tp, clrGold);
            rest = StringSubstr(rest, end + 1);
         }
      }
      ChartRedraw(0);
   }

   PlaceFromSignal(alertJson, bias);
}

int OnInit()
{
   g_trade.SetExpertMagicNumber(InpMagic);
   EventSetTimer(InpPollSec);
   HandleSignal();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   HandleSignal();
}

//+------------------------------------------------------------------+
