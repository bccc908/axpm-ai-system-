import type { OkBrainMap } from "@/lib/market-signals/ok-brain-map";

export type EthSignalBias = "long" | "short" | "neutral" | "wait";

export type EthSignalStrength = "weak" | "moderate" | "strong";

export interface EthPriceZone {
  low: number;
  high: number;
}

export interface EthSignal {
  id: string;
  created_at: string;
  symbol: "ETHUSD";
  spot_price: number | null;
  bias: EthSignalBias;
  strength: EthSignalStrength;
  confidence: number;
  timeframe: string;
  entry_zone: EthPriceZone | null;
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

export interface EthSignalStore {
  signals: EthSignal[];
  updated_at: string;
}
