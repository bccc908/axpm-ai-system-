export const MIN_CONFIDENCE = 65;
export const MAX_AGE_MS = 6 * 3600_000;
export const MAX_CHASE_PCT = 0.012;
export const MAX_STOP_PCT = 0.015;

export type GateInput = {
  source: "gold" | "btc" | "hl" | string;
  bias: string;
  confidence: number;
  created_at: string;
  expires_at?: string | null;
  entry_low: number | null;
  entry_high: number | null;
  stop_loss: number | null;
};

export type GateResult = { ok: true } | { ok: false; reason: string; dead: boolean };

function ageMs(created_at: string, now: number) {
  const created = Date.parse(created_at);
  if (!Number.isFinite(created)) return Number.POSITIVE_INFINITY;
  return now - created;
}

export function gateBtcTrade(input: GateInput, mark: number, now = Date.now()): GateResult {
  if (input.source === "gold") {
    return { ok: false, reason: "gold never fires on Hyperliquid", dead: false };
  }
  if (input.bias !== "long" && input.bias !== "short") {
    return { ok: false, reason: "bias is not long/short", dead: true };
  }
  if (input.confidence < MIN_CONFIDENCE) {
    return { ok: false, reason: `confidence ${input.confidence}% < ${MIN_CONFIDENCE}%`, dead: true };
  }
  if (ageMs(input.created_at, now) > MAX_AGE_MS) {
    return { ok: false, reason: "signal older than 6h", dead: true };
  }
  if (input.expires_at) {
    const exp = Date.parse(input.expires_at);
    if (Number.isFinite(exp) && now > exp) {
      return { ok: false, reason: "signal expired", dead: true };
    }
  }
  if (!Number.isFinite(mark) || mark <= 0) {
    return { ok: false, reason: "no live mark", dead: false };
  }
  if (input.entry_low == null || input.entry_high == null) {
    return { ok: false, reason: "no entry zone · refuse chase", dead: true };
  }
  const lo = Math.min(input.entry_low, input.entry_high) * (1 - MAX_CHASE_PCT);
  const hi = Math.max(input.entry_low, input.entry_high) * (1 + MAX_CHASE_PCT);
  if (mark < lo || mark > hi) {
    return {
      ok: false,
      reason: `mark ${mark.toFixed(mark >= 1000 ? 0 : 1)} outside ${lo.toFixed(mark >= 1000 ? 0 : 1)}–${hi.toFixed(mark >= 1000 ? 0 : 1)}`,
      dead: false,
    };
  }
  if (input.stop_loss != null) {
    const sl = input.stop_loss;
    if (input.bias === "long" && sl >= mark) {
      return { ok: false, reason: "stop not below long", dead: true };
    }
    if (input.bias === "short" && sl <= mark) {
      return { ok: false, reason: "stop not above short", dead: true };
    }
    const dist = Math.abs(mark - sl) / mark;
    if (dist > MAX_STOP_PCT) {
      return { ok: false, reason: `stop ${Math.round(dist * 1000) / 10}% too wide`, dead: true };
    }
    if (dist < 0.002) {
      return { ok: false, reason: "stop too tight", dead: true };
    }
  }
  return { ok: true };
}

export function bracketPrices(
  mark: number,
  side: "long" | "short",
  stop: number | null,
  takeProfit: number | null,
) {
  const buy = side === "long";
  const sl = stop != null && Number.isFinite(stop) ? stop : buy ? mark * 0.99 : mark * 1.01;
  const risk = Math.abs(mark - sl);
  const twoR = buy ? mark + 2 * risk : mark - 2 * risk;
  let tp = twoR;
  if (takeProfit != null && Number.isFinite(takeProfit)) {
    const reward = buy ? takeProfit - mark : mark - takeProfit;
    if (reward >= risk * 1.5) tp = takeProfit;
  }
  return {
    sl: String(Math.round(sl)),
    tp: String(Math.round(tp)),
  };
}
