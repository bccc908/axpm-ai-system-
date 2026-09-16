import type { OkBrainMap } from "@/lib/market-signals/ok-brain-map";

export type BtcSignalBias = "long" | "short" | "neutral" | "wait";

export type BtcSignalStrength = "weak" | "moderate" | "strong";

export interface BtcPriceZone {
  low: number;
  high: number;
}

export interface BtcSignal {
  id: string;
  created_at: string;
  symbol: "BTCUSD";
  spot_price: number | null;
  bias: BtcSignalBias;
  strength: BtcSignalStrength;
  confidence: number;
  timeframe: string;
  entry_zone: BtcPriceZone | null;
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

export interface BtcSignalStore {
  signals: BtcSignal[];
  updated_at: string;
}
