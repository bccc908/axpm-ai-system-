export type GoldSpreadLeader = "xauusd" | "xauusdt" | "aligned";

export type GoldSpreadSnapshot = {
  xauusd: number;
  xauusdt: number;
  spread: number;
  spread_pct: number;
  xauusd_change_pct: number | null;
  xauusdt_change_pct: number | null;
  leader: GoldSpreadLeader;
  xauusd_source: string;
  xauusdt_source: string;
  as_of: string;
};

export type GoldSpreadSignal = {
  id: string;
  created_at: string;
  symbol: "XAUUSD-XAUUSDT";
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
  ok_brain_map?: import("@/lib/market-signals/ok-brain-map").OkBrainMap | null;
  spread: GoldSpreadSnapshot;
};

export type GoldSpreadStore = {
  signals: GoldSpreadSignal[];
  updated_at: string;
};
