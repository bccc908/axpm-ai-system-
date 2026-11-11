/** Risk Manager Review — shared types (safe for client and server). */

export type RiskFlagSeverity = "info" | "warn" | "critical";

export interface RiskFlag {
  code:
    | "rr_below_min"
    | "invalid_geometry"
    | "missing_levels"
    | "no_directional_bias"
    | "stop_too_tight_atr"
    | "stop_too_wide_atr"
    | "stop_near_liquidity"
    | "entry_far_from_price"
    | "no_market_context";
  severity: RiskFlagSeverity;
  message: string;
}

export interface RiskTarget {
  price: number;
  reward_pts: number;
  /** Reward ÷ risk */
  r: number;
  /** 1 / (1 + R) */
  breakeven_win_rate: number;
}

export interface LiquidityZone {
  price: number;
  label: string;
  kind: "round_number" | "value_area" | "vwap" | "poc" | "swing_high" | "swing_low";
  /** Signed distance stop → level (level − stop) in points */
  distance_from_stop: number;
  /** Level sits between the stop and the entry, or within the stop-hunt buffer beyond the stop */
  stop_hunt_risk: boolean;
}

/** Indicator context computed deterministically from OHLC bars. */
export interface RiskMarketContext {
  interval: string;
  /** Bar data source, e.g. "GC=F" */
  source: string;
  bars: number;
  last_close: number;
  vwap: number | null;
  poc: number | null;
  vah: number | null;
  val: number | null;
  range_high: number;
  range_low: number;
  /** 0 = at range low, 1 = at range high */
  range_pos: number | null;
  /** Cumulative OHLC-proxy delta over the window */
  cum_delta: number | null;
  /** Delta over the last 20 bars */
  recent_delta: number | null;
  rsi14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  atr14: number | null;
  swing_high: number | null;
  swing_low: number | null;
}

export interface RiskDeterministicChecks {
  side: "long" | "short" | null;
  entry: number | null;
  stop: number | null;
  risk_pts: number | null;
  targets: RiskTarget[];
  /** R of TP1 (primary target) */
  primary_r: number | null;
  /** 1 / (1 + primary_r) */
  breakeven_win_rate: number | null;
  min_r: number;
  rr_below_min: boolean;
  stop_atr_multiple: number | null;
  entry_distance_pts: number | null;
  liquidity_zones: LiquidityZone[];
  flags: RiskFlag[];
}

export type RiskVerdict = "take_trade" | "stand_aside";

export interface RiskAiReview {
  summary: string;
  confluence: { supporting: string[]; weak_or_forced: string[] };
  trap_zones: { price: number | null; label: string; note: string }[];
  devils_advocate: string[];
  score: number;
  verdict: RiskVerdict;
  conditions: string[];
  /** Set when a deterministic hard rule overrode the model's verdict/score */
  overridden_by_rule: string | null;
  model: string;
}

export type RiskAiStatus =
  | { state: "ok" }
  | {
      state: "unavailable";
      reason: "insufficient_balance" | "not_configured" | "request_failed" | "invalid_output";
      detail: string;
    };

export interface SignalRiskReview {
  signal_id: string;
  version: 1;
  created_at: string;
  locale: "en" | "zh";
  checks: RiskDeterministicChecks;
  context: RiskMarketContext | null;
  ai: RiskAiReview | null;
  ai_status: RiskAiStatus;
}
