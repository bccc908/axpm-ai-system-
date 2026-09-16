import type { OkBrainMap } from "@/lib/market-signals/ok-brain-map";

export type HlSignalBias = "long" | "short" | "neutral" | "wait";
export type HlSignalStrength = "weak" | "moderate" | "strong";

export interface HlPriceZone {
  low: number;
  high: number;
}

export interface HlSignal {
  id: string;
  created_at: string;
  symbol: "BTC-PERP";
  spot_price: number | null;
  bias: HlSignalBias;
  strength: HlSignalStrength;
  confidence: number;
  timeframe: string;
  entry_zone: HlPriceZone | null;
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

export interface HlSignalStore {
  signals: HlSignal[];
  updated_at: string;
}
