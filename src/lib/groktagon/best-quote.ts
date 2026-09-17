import "server-only";

import { fetchEthDayRange, fetchHlBook, type HlBookQuote } from "@/lib/hyperliquid/book";
import type { EthSignal } from "@/types/eth-signal";
import type { GroktagonQuotePlan, GroktagonQuoteSetup } from "@/types/groktagon";

type SessionWindow = GroktagonQuotePlan["window"];

function hktMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function sessionAt(mins: number): { window: SessionWindow; label: string } {
  if (mins >= 20 * 60 + 30 || mins < 5 * 60) {
    return { window: "overlap", label: "20:30–05:00 HKT · London/NY overlap" };
  }
  if (mins >= 15 * 60) {
    return { window: "london", label: "15:00–20:30 HKT · London cash" };
  }
  if (mins >= 7 * 60) {
    return { window: "asia", label: "07:00–15:00 HKT · Asia" };
  }
  return { window: "thin", label: "00:00–07:00 HKT · thin book" };
}

function minsUntilOverlap(mins: number) {
  const start = 20 * 60 + 30;
  if (mins >= start || mins < 5 * 60) return 0;
  return start - mins;
}

function fmtClock(totalMins: number) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function px(n: number) {
  return n >= 1000 ? n.toFixed(1) : n.toFixed(2);
}

function sideOf(text: string): "long" | "short" | null {
  if (/做空|空头|受阻做空|\bshort\b/i.test(text)) return "short";
  if (/做多|多头|追多|轻仓做多|\blong\b/i.test(text)) return "long";
  return null;
}

function numbersIn(text: string) {
  return [...text.matchAll(/\d{4,5}(?:\.\d+)?/g)]
    .map((m) => Number(m[0]))
    .filter((n) => n >= 1000 && n <= 20_000);
}

function stopIn(text: string) {
  const m = text.match(/止损\s*(\d{4,5}(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export function setupsFromSignal(signal: EthSignal | null): GroktagonQuoteSetup[] {
  if (!signal) return [];
  const out: GroktagonQuoteSetup[] = [];
  if (signal.entry_zone && (signal.bias === "long" || signal.bias === "short")) {
    out.push({
      side: signal.bias,
      low: Math.min(signal.entry_zone.low, signal.entry_zone.high),
      high: Math.max(signal.entry_zone.low, signal.entry_zone.high),
      stop: signal.stop_loss,
      target: signal.take_profit[0] ?? null,
      when: "live entry zone from ETH plan",
    });
  }
  for (const line of signal.orderflow_triggers ?? []) {
    const side = sideOf(line);
    if (!side) continue;
    const nums = numbersIn(line);
    if (nums.length < 2) continue;
    const range = [...line.matchAll(/(\d{4,5}(?:\.\d+)?)\s*[-–~至到]\s*(\d{4,5}(?:\.\d+)?)/g)][0];
    const low = range ? Math.min(Number(range[1]), Number(range[2])) : Math.min(nums[0], nums[1]);
    const high = range ? Math.max(Number(range[1]), Number(range[2])) : Math.max(nums[0], nums[1]);
    out.push({
      side,
      low,
      high,
      stop: stopIn(line),
      target: nums.find((n) => n < low - 5 || n > high + 5) ?? null,
      when: line.replace(/\s+/g, " ").slice(0, 72),
    });
  }
  return out.slice(0, 4);
}

function midRange(mark: number, low: number, high: number) {
  const span = high - low;
  if (span <= 0) return true;
  const pos = (mark - low) / span;
  return pos > 0.2 && pos < 0.92;
}

function isConfirmOnly(when: string) {
  return /POC|确认.*结构/.test(when);
}

function pickWaitSetup(
  mark: number,
  setups: GroktagonQuoteSetup[],
  range: { low: number; high: number } | null,
): GroktagonQuoteSetup | null {
  const tradeable = setups.filter((s) => !isConfirmOnly(s.when));
  const pool = tradeable.length ? tradeable : setups;
  if (range && midRange(mark, range.low, range.high) && pool.length) {
    const span = range.high - range.low || 1;
    const nearExtreme = [...pool]
      .map((s) => {
        const mid = (s.low + s.high) / 2;
        const extreme = Math.min(Math.abs(mid - range.low), Math.abs(mid - range.high));
        return { s, extreme };
      })
      .sort((a, b) => a.extreme - b.extreme);
    if (nearExtreme[0] && nearExtreme[0].extreme / span < 0.28) {
      return nearExtreme[0].s;
    }
  }
  const far = pool
    .map((s) => {
      const mid = (s.low + s.high) / 2;
      return { s, dist: Math.abs(mark - mid) / mark };
    })
    .filter((x) => x.dist >= 0.008)
    .sort((a, b) => a.dist - b.dist);
  if (far[0]) return far[0].s;
  if (range) {
    const longMid = (range.low + range.low * 1.008) / 2;
    const shortMid = (range.high * 0.992 + range.high) / 2;
    return Math.abs(mark - longMid) <= Math.abs(mark - shortMid)
      ? {
          side: "long",
          low: range.low,
          high: Math.round(range.low * 1.008 * 10) / 10,
          stop: Math.round(range.low * 0.992 * 10) / 10,
          target: null,
          when: "wait 24h low, not mid-range",
        }
      : {
          side: "short",
          low: Math.round(range.high * 0.992 * 10) / 10,
          high: range.high,
          stop: Math.round(range.high * 1.008 * 10) / 10,
          target: null,
          when: "wait 24h high, not mid-range",
        };
  }
  return setups[0] ?? null;
}

export function buildEthQuotePlan(input: {
  book: HlBookQuote | null;
  mark: number | null;
  signal: EthSignal | null;
  range: { low: number; high: number } | null;
  fireSide: "long" | "short" | null;
  fireReason: string;
  now?: Date;
}): GroktagonQuotePlan {
  const now = input.now ?? new Date();
  const mins = hktMinutes(now);
  const session = sessionAt(mins);
  const waitMins = minsUntilOverlap(mins);
  const mark = input.book?.mid ?? input.mark;
  const setups = setupsFromSignal(input.signal);
  const waitSetup = mark != null ? pickWaitSetup(mark, setups, input.range) : setups[0] ?? null;
  const inMid =
    mark != null && input.range != null ? midRange(mark, input.range.low, input.range.high) : true;
  const bias = input.signal?.bias ?? "wait";
  const fire = Boolean(input.fireSide) && (bias === "long" || bias === "short");
  const action: GroktagonQuotePlan["action"] = fire ? input.fireSide! : "WAIT";

  const touchBuy = input.book?.ask ?? mark;
  const touchSell = input.book?.bid ?? mark;
  let best_price: string;
  let best_time: string;
  let headline: string;
  let reason: string;

  if (fire && input.fireSide === "long") {
    best_price = touchBuy != null ? `BUY ${px(touchBuy)} (ask)` : "no ask";
    best_time = session.window === "thin" ? "NOW · book is thin, clip is still tiny" : "NOW";
    headline = `ETH LONG · lift ${touchBuy != null ? px(touchBuy) : "—"}`;
    reason = input.fireReason;
  } else if (fire && input.fireSide === "short") {
    best_price = touchSell != null ? `SELL ${px(touchSell)} (bid)` : "no bid";
    best_time = session.window === "thin" ? "NOW · book is thin, clip is still tiny" : "NOW";
    headline = `ETH SHORT · hit ${touchSell != null ? px(touchSell) : "—"}`;
    reason = input.fireReason;
  } else {
    best_price = waitSetup
      ? `WAIT ${waitSetup.side.toUpperCase()} ${px(waitSetup.low)}–${px(waitSetup.high)}`
      : "WAIT · no 2R zone at mark";
    best_time =
      waitMins > 0
        ? `after ${fmtClock(mins + waitMins)} HKT · ${session.label}`
        : `window open · still wait trigger, do not chase mid`;
    const conf = input.signal?.confidence ?? 0;
    const tape =
      input.book != null ? `${px(input.book.bid)}/${px(input.book.ask)}` : mark != null ? px(mark) : "—";
    headline = `ETH ${tape} · WAIT ${conf}% · ${best_price}`;
    reason =
      input.fireReason ||
      (inMid
        ? "mark sits in the 24h mid · no chase"
        : `${bias} ${conf}% is not a live zone`);
  }

  return {
    coin: "ETH",
    fire,
    action,
    headline,
    reason,
    mark: mark ?? null,
    bid: input.book?.bid ?? null,
    ask: input.book?.ask ?? null,
    spread_bps: input.book ? Math.round(input.book.spread_bps * 1000) / 1000 : null,
    bid_usd: input.book ? Math.round(input.book.bid_usd) : null,
    ask_usd: input.book ? Math.round(input.book.ask_usd) : null,
    best_price,
    best_time,
    window: session.window,
    window_label: session.label,
    expires_at: input.signal?.expires_at ?? null,
    setups,
    wait_setup: waitSetup,
    range_low: input.range?.low ?? null,
    range_high: input.range?.high ?? null,
    bias,
    confidence: input.signal?.confidence ?? null,
    thesis: (input.signal?.thesis ?? "").replace(/\s+/g, " ").slice(0, 180),
  };
}

export async function loadEthQuotePlan(input: {
  mark: number | null;
  signal: EthSignal | null;
  fireSide: "long" | "short" | null;
  fireReason: string;
}): Promise<GroktagonQuotePlan> {
  const [book, range] = await Promise.all([
    fetchHlBook("ETH").catch(() => null),
    fetchEthDayRange().catch(() => null),
  ]);
  return buildEthQuotePlan({
    book,
    mark: input.mark,
    signal: input.signal,
    range,
    fireSide: input.fireSide,
    fireReason: input.fireReason,
  });
}
