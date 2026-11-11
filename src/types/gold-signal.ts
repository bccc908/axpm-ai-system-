import type { WithApproval } from "@/lib/signal-approval/types";
import type { OkBrainMap } from "@/lib/market-signals/ok-brain-map";

export type GoldSignalBias = "long" | "short" | "neutral" | "wait";

export type GoldSignalStrength = "weak" | "moderate" | "strong";

export interface GoldPriceZone {
  low: number;
  high: number;
}

export interface GoldSignal extends WithApproval {
  id: string;
  created_at: string;
  symbol: "XAUUSD";
  spot_price: number | null;
  bias: GoldSignalBias;
  strength: GoldSignalStrength;
  confidence: number;
  timeframe: string;
  entry_zone: GoldPriceZone | null;
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
}

export interface GoldSignalStore {
  signals: GoldSignal[];
  updated_at: string;
}

export interface GoldPriceLevel {
  price: number;
  label: string;
  kind: "entry_low" | "entry_high" | "stop" | "target" | "invalidation";
}

/** Compact payload for ATAS / external chart tools */
export interface AtasGoldAlert {
  symbol: string;
  bias: GoldSignalBias;
  strength: GoldSignalStrength;
  confidence: number;
  spot: number | null;
  entry: number | null;
  entry_zone: GoldPriceZone | null;
  stop: number | null;
  targets: number[];
  levels: GoldPriceLevel[];
  alert: string;
  playbook: string;
  cluster_triggers: string[];
  invalidation: string;
  timeframe: string;
  updated_at: string;
  signal_id: string;
}

/** Compact payload for Bookmap L1 add-on polling */
export interface BookmapGoldAlert {
  symbol: string;
  bias: GoldSignalBias;
  strength: GoldSignalStrength;
  confidence: number;
  spot: number | null;
  entry: number | null;
  stop: number | null;
  targets: number[];
  alert: string;
  playbook: string;
  invalidation: string;
  timeframe: string;
  updated_at: string;
  signal_id: string;
}

/** Compact payload for MetaTrader 5 EA / script polling */
export interface Mt5GoldAlert extends AtasGoldAlert {
  /** Suggested chart symbol (broker may use XAUUSD, GOLD, XAUUSDm, etc.) */
  mt5_symbols: string[];
  magic_number: number;
  order_comment: string;
  /** Hint only — EA uses InpLots unless you change it */
  suggested_lots: number;
}
