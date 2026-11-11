/**
 * Deterministic risk checks — pure functions, no LLM, no I/O.
 * Safe to import from client and server code.
 */
import { computeEma, computeMacd, computeRsi, type GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import { barBuySellVolume } from "@/lib/gold-signals/order-flow";
import type {
  LiquidityZone,
  RiskDeterministicChecks,
  RiskFlag,
  RiskMarketContext,
  RiskTarget,
} from "@/lib/gold-signals/risk-review/types";

export const MIN_RR = 1.5;

/** Minimal signal shape the checks need (GoldSignal and DeskSignal both satisfy it). */
export interface RiskSignalInput {
  id: string;
  bias: "long" | "short" | "neutral" | "wait";
  spot_price: number | null;
  timeframe: string;
  entry_zone: { low: number; high: number } | null;
  stop_loss: number | null;
  take_profit: number[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const last = <T>(arr: T[]): T | undefined => arr[arr.length - 1];

export function computeAtr(bars: GoldOhlcBar[], period = 14): number | null {
  if (bars.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prevClose = bars[i - 1].close;
    trs.push(Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose)));
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return r2(atr);
}

/** Volume profile: POC + 70% value area, using typical price buckets. */
export function computeValueArea(bars: GoldOhlcBar[], bucket = 1) {
  const vols = new Map<number, number>();
  let total = 0;
  for (const b of bars) {
    if (!(b.volume > 0)) continue;
    const tp = (b.high + b.low + b.close) / 3;
    const key = Math.round(tp / bucket) * bucket;
    vols.set(key, (vols.get(key) ?? 0) + b.volume);
    total += b.volume;
  }
  if (total <= 0 || vols.size === 0) return null;
  const levels = [...vols.keys()].sort((a, b) => a - b);
  let pocIdx = 0;
  levels.forEach((p, i) => {
    if ((vols.get(p) ?? 0) > (vols.get(levels[pocIdx]) ?? 0)) pocIdx = i;
  });
  let lo = pocIdx;
  let hi = pocIdx;
  let acc = vols.get(levels[pocIdx]) ?? 0;
  while (acc < total * 0.7 && (lo > 0 || hi < levels.length - 1)) {
    const down = lo > 0 ? (vols.get(levels[lo - 1]) ?? 0) : -1;
    const up = hi < levels.length - 1 ? (vols.get(levels[hi + 1]) ?? 0) : -1;
    if (up >= down) {
      hi += 1;
      acc += up;
    } else {
      lo -= 1;
      acc += down;
    }
  }
  return { poc: r2(levels[pocIdx]), vah: r2(levels[hi]), val: r2(levels[lo]) };
}

export function computeMarketContext(
  bars: GoldOhlcBar[],
  opts: { interval: string; source?: string; livePrice?: number | null },
): RiskMarketContext | null {
  const clean = bars.filter(
    (b) => [b.open, b.high, b.low, b.close].every((v) => Number.isFinite(v)) && b.high >= b.low,
  );
  if (clean.length < 20) return null;

  const lastBar = clean[clean.length - 1];
  const price = opts.livePrice != null && Number.isFinite(opts.livePrice) ? opts.livePrice : lastBar.close;

  // Session VWAP: bars since the last UTC-day boundary (fallback: whole window)
  const dayStart = Math.floor(lastBar.time / 86400) * 86400;
  const session = clean.filter((b) => b.time >= dayStart);
  const vwapBars = session.length >= 5 ? session : clean;
  let pv = 0;
  let vol = 0;
  for (const b of vwapBars) {
    if (!(b.volume > 0)) continue;
    pv += ((b.high + b.low + b.close) / 3) * b.volume;
    vol += b.volume;
  }
  const vwap = vol > 0 ? r2(pv / vol) : null;

  const va = computeValueArea(vwapBars);
  const rangeHigh = Math.max(...clean.map((b) => b.high));
  const rangeLow = Math.min(...clean.map((b) => b.low));
  const rangePos = rangeHigh - rangeLow > 0.01 ? r4((price - rangeLow) / (rangeHigh - rangeLow)) : null;

  const deltas = clean.map((b) => {
    const { buyVol, sellVol } = barBuySellVolume(b);
    return buyVol - sellVol;
  });
  const hasVolume = clean.some((b) => b.volume > 0);
  const cumDelta = hasVolume ? Math.round(deltas.reduce((s, d) => s + d, 0)) : null;
  const recentDelta = hasVolume ? Math.round(deltas.slice(-20).reduce((s, d) => s + d, 0)) : null;

  const macd = computeMacd(clean);
  const recent = clean.slice(-40);

  return {
    interval: opts.interval,
    source: opts.source ?? "unknown",
    bars: clean.length,
    last_close: r2(price),
    vwap,
    poc: va?.poc ?? null,
    vah: va?.vah ?? null,
    val: va?.val ?? null,
    range_high: r2(rangeHigh),
    range_low: r2(rangeLow),
    range_pos: rangePos,
    cum_delta: cumDelta,
    recent_delta: recentDelta,
    rsi14: last(computeRsi(clean, 14))?.value ?? null,
    macd: last(macd.macd)?.value ?? null,
    macd_signal: last(macd.signal)?.value ?? null,
    macd_hist: last(macd.histogram)?.value ?? null,
    ema9: last(computeEma(clean, 9))?.value ?? null,
    ema21: last(computeEma(clean, 21))?.value ?? null,
    ema50: last(computeEma(clean, 50))?.value ?? null,
    atr14: computeAtr(clean, 14),
    swing_high: recent.length ? r2(Math.max(...recent.map((b) => b.high))) : null,
    swing_low: recent.length ? r2(Math.min(...recent.map((b) => b.low))) : null,
  };
}

function roundNumbersNear(price: number, span: number): number[] {
  const out = new Set<number>();
  for (const step of [10, 25, 50, 100]) {
    const lo = Math.floor((price - span) / step) * step;
    for (let p = lo; p <= price + span; p += step) out.add(p);
  }
  return [...out].filter((p) => Math.abs(p - price) <= span).sort((a, b) => a - b);
}

function roundLabel(p: number) {
  if (p % 100 === 0) return "Round number (00)";
  if (p % 50 === 0) return "Round number (50)";
  if (p % 25 === 0) return "Quarter level (25)";
  return "Round number (10)";
}

/** Deterministic R:R, breakeven win rate, ATR stop sizing and stop-hunt zones. */
export function computeDeterministicChecks(
  signal: RiskSignalInput,
  context: RiskMarketContext | null,
): RiskDeterministicChecks {
  const flags: RiskFlag[] = [];
  const side = signal.bias === "long" ? "long" : signal.bias === "short" ? "short" : null;
  const entry = signal.entry_zone
    ? r2((signal.entry_zone.low + signal.entry_zone.high) / 2)
    : signal.spot_price != null
      ? r2(signal.spot_price)
      : null;
  const stop = signal.stop_loss;

  if (!side) {
    flags.push({
      code: "no_directional_bias",
      severity: "critical",
      message: `Signal bias is "${signal.bias}" — there is no directional trade to take.`,
    });
  }

  let riskPts: number | null = null;
  const targets: RiskTarget[] = [];

  if (entry == null || stop == null || signal.take_profit.length === 0) {
    flags.push({
      code: "missing_levels",
      severity: "critical",
      message: "Entry, stop or take-profit is missing, so R:R cannot be computed.",
    });
  } else {
    riskPts = r2(Math.abs(entry - stop));
    const geometryOk =
      side === "long"
        ? stop < entry && signal.take_profit.every((tp) => tp > entry)
        : side === "short"
          ? stop > entry && signal.take_profit.every((tp) => tp < entry)
          : true;
    if (!geometryOk) {
      flags.push({
        code: "invalid_geometry",
        severity: "critical",
        message: `Levels are inconsistent with a ${side} trade (stop/targets on the wrong side of entry).`,
      });
    }
    if (riskPts >= 0.01) {
      for (const tp of signal.take_profit) {
        const reward = r2(Math.abs(tp - entry));
        const r = r2(reward / riskPts);
        targets.push({ price: tp, reward_pts: reward, r, breakeven_win_rate: r4(1 / (1 + r)) });
      }
    }
  }

  const primaryR = targets[0]?.r ?? null;
  const breakeven = primaryR != null ? r4(1 / (1 + primaryR)) : null;
  const rrBelowMin = primaryR != null && primaryR < MIN_RR;
  if (rrBelowMin) {
    flags.push({
      code: "rr_below_min",
      severity: "critical",
      message: `R:R to TP1 is 1:${primaryR?.toFixed(2)} — below the 1:${MIN_RR} minimum. Breakeven win rate ${(breakeven! * 100).toFixed(1)}%.`,
    });
  }

  const atr = context?.atr14 ?? null;
  const stopAtr = riskPts != null && atr != null && atr > 0 ? r2(riskPts / atr) : null;
  if (stopAtr != null) {
    if (stopAtr < 0.5) {
      flags.push({
        code: "stop_too_tight_atr",
        severity: "warn",
        message: `Stop is only ${stopAtr}× ATR(14) (${atr} pts) — inside normal noise, high chance of being wicked out.`,
      });
    } else if (stopAtr > 3) {
      flags.push({
        code: "stop_too_wide_atr",
        severity: "warn",
        message: `Stop is ${stopAtr}× ATR(14) (${atr} pts) — position size must shrink to keep risk constant.`,
      });
    }
  }

  const price = context?.last_close ?? signal.spot_price;
  const entryDistance = entry != null && price != null ? r2(Math.abs(price - entry)) : null;
  if (entryDistance != null && atr != null && entryDistance > 2 * atr) {
    flags.push({
      code: "entry_far_from_price",
      severity: "info",
      message: `Current price is ${entryDistance} pts (${r2(entryDistance / atr)}× ATR) from the entry — the setup may be stale.`,
    });
  }

  // Liquidity / stop-hunt zones around the stop
  const zones: LiquidityZone[] = [];
  if (stop != null && entry != null) {
    const buffer = Math.max(atr != null ? atr * 0.5 : 0, 1.5);
    const span = Math.max(riskPts ?? 0, buffer) * 2 + 5;
    const between = (p: number) => (p - stop) * (entry - p) > 0;
    const beyondStop = (p: number) =>
      side === "long" ? p < stop && stop - p <= buffer : side === "short" ? p > stop && p - stop <= buffer : false;
    const add = (price: number | null | undefined, label: string, kind: LiquidityZone["kind"]) => {
      if (price == null || !Number.isFinite(price)) return;
      if (Math.abs(price - stop) > span) return;
      if (zones.some((z) => Math.abs(z.price - price) < 0.05 && z.kind === kind)) return;
      zones.push({
        price: r2(price),
        label,
        kind,
        distance_from_stop: r2(price - stop),
        stop_hunt_risk: Math.abs(price - stop) <= buffer || (between(price) && Math.abs(price - stop) <= buffer * 2) || beyondStop(price),
      });
    };
    for (const p of roundNumbersNear(stop, span)) add(p, roundLabel(p), "round_number");
    add(context?.vah, "VAH", "value_area");
    add(context?.val, "VAL", "value_area");
    add(context?.poc, "POC", "poc");
    add(context?.vwap, "VWAP", "vwap");
    add(context?.swing_high, "Recent swing high", "swing_high");
    add(context?.swing_low, "Recent swing low", "swing_low");
    zones.sort((a, b) => Math.abs(a.distance_from_stop) - Math.abs(b.distance_from_stop));

    const hunted = zones.filter((z) => z.stop_hunt_risk);
    if (hunted.length > 0) {
      flags.push({
        code: "stop_near_liquidity",
        severity: "warn",
        message: `Stop ${stop} sits within ${r2(Math.max(...hunted.map((z) => Math.abs(z.distance_from_stop))))} pts of ${hunted
          .slice(0, 3)
          .map((z) => `${z.label} ${z.price}`)
          .join(", ")} — obvious liquidity, classic stop-hunt zone.`,
      });
    }
  }

  if (!context) {
    flags.push({
      code: "no_market_context",
      severity: "info",
      message: "No real price bars available (only estimated or none) — ATR, VWAP and value-area checks were skipped.",
    });
  }

  return {
    side,
    entry,
    stop,
    risk_pts: riskPts,
    targets,
    primary_r: primaryR,
    breakeven_win_rate: breakeven,
    min_r: MIN_RR,
    rr_below_min: rrBelowMin,
    stop_atr_multiple: stopAtr,
    entry_distance_pts: entryDistance,
    liquidity_zones: zones.slice(0, 8),
    flags,
  };
}
