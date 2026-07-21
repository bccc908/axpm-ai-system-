export type SignalInstrument = "gold" | "btc";

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
  },
  btc: {
    id: "btc",
    symbol: "BTCUSD",
    yahooSymbol: "BTC-USD",
    apiBase: "/api/btc-signals",
    priceTick: 10,
    badge: "BTCUSD",
    dataSource: "BTC-USD",
  },
};
