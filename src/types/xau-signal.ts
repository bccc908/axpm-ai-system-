import type { WithApproval } from "@/lib/signal-approval/types";
import type { OkBrainMap } from "@/lib/market-signals/ok-brain-map";

export type XauSignalBias = "long" | "short" | "neutral" | "wait";

export type XauSignalStrength = "weak" | "moderate" | "strong";

export interface XauPriceZone {
  low: number;
  high: number;
}

export interface XauSignal extends WithApproval {
  id: string;
  created_at: string;
  symbol: "XAUUSDT";
  spot_price: number | null;
  bias: XauSignalBias;
  strength: XauSignalStrength;
  confidence: number;
  timeframe: string;
  entry_zone: XauPriceZone | null;
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

export interface XauSignalStore {
  signals: XauSignal[];
  updated_at: string;
}
