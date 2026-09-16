import type { OkBrainMap } from "@/lib/market-signals/ok-brain-map";

export type SignalInstrument = "gold" | "xau" | "spread" | "btc" | "eth" | "hl";

export type SignalI18nNs =
  | "goldSignals"
  | "xauSignals"
  | "spreadSignals"
  | "btcSignals"
  | "ethSignals"
  | "hlSignals";

export type DeskSignal = {
  id: string;
  created_at: string;
  symbol: string;
  spot_price: number | null;
  bias: "long" | "short" | "neutral" | "wait";
  strength: "weak" | "moderate" | "strong";
  confidence: number;
  timeframe: string;
  entry_zone: { low: number; high: number } | null;
  stop_loss: number | null;
  take_profit: number[];
  thesis: string;
  bookmap_playbook: string;
  orderflow_triggers: string[];
  risk_notes: string;
  invalidation: string;
  expires_at: string | null;
  notes?: string | null;
  ok_brain_map?: OkBrainMap | null;
  spread?: {
    xauusd: number;
    xauusdt: number;
    spread: number;
    spread_pct: number;
    xauusd_change_pct: number | null;
    xauusdt_change_pct: number | null;
    leader: "xauusd" | "xauusdt" | "aligned";
    xauusd_source: string;
    xauusdt_source: string;
  };
};

export const SIGNAL_INSTRUMENTS: Record<
  SignalInstrument,
  {
    id: SignalInstrument;
    symbol: string;
    yahooSymbol: string;
    apiBase: string;
    priceTick: number;
    badge: string;
    dataSource: string;
    i18nNs: SignalI18nNs;
    tabKey: string;
    wsPair: "btcusdt" | "ethusdt" | "xauusdt" | null;
  }
> = {
  gold: {
    id: "gold",
    symbol: "XAUUSD",
    yahooSymbol: "GC=F",
    apiBase: "/api/gold-signals",
    priceTick: 0.5,
    badge: "XAUUSD",
    dataSource: "GC=F",
    i18nNs: "goldSignals",
    tabKey: "goldSignals.tabGold",
    wsPair: null,
  },
  xau: {
    id: "xau",
    symbol: "XAUUSDT",
    yahooSymbol: "XAUUSDT",
    apiBase: "/api/xau-signals",
    priceTick: 0.1,
    badge: "XAUUSDT",
    dataSource: "XAUUSDT",
    i18nNs: "xauSignals",
    tabKey: "goldSignals.tabXau",
    wsPair: "xauusdt",
  },
  spread: {
    id: "spread",
    symbol: "XAUUSD-XAUUSDT",
    yahooSymbol: "XAUUSDT",
    apiBase: "/api/gold-spread",
    priceTick: 0.1,
    badge: "USD vs USDT",
    dataSource: "XAUUSD / XAUUSDT",
    i18nNs: "spreadSignals",
    tabKey: "goldSignals.tabSpread",
    wsPair: "xauusdt",
  },
  btc: {
    id: "btc",
    symbol: "BTCUSD",
    yahooSymbol: "BTC-USD",
    apiBase: "/api/btc-signals",
    priceTick: 10,
    badge: "BTCUSD",
    dataSource: "BTC-USD",
    i18nNs: "btcSignals",
    tabKey: "goldSignals.tabBtc",
    wsPair: "btcusdt",
  },
  eth: {
    id: "eth",
    symbol: "ETHUSD",
    yahooSymbol: "ETH-USD",
    apiBase: "/api/eth-signals",
    priceTick: 1,
    badge: "ETHUSD",
    dataSource: "ETH-USD",
    i18nNs: "ethSignals",
    tabKey: "goldSignals.tabEth",
    wsPair: "ethusdt",
  },
  hl: {
    id: "hl",
    symbol: "BTC-PERP",
    yahooSymbol: "BTC-PERP",
    apiBase: "/api/hl-signals",
    priceTick: 1,
    badge: "HL BTC",
    dataSource: "Hyperliquid",
    i18nNs: "hlSignals",
    tabKey: "goldSignals.tabHl",
    wsPair: null,
  },
};
