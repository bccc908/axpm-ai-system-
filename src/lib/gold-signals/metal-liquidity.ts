import "server-only";

import { fetchGoldOhlc } from "@/lib/gold-signals/chart-data";
import { fetchGoldSpotQuote } from "@/lib/gold-signals/price";
import { fetchGoldBookDepth, type GoldBookDepth, type GoldBookLevel } from "@/lib/gold-signals/xau-depth";
import { fetchEmXauPrints, type XauPrint } from "@/lib/gold-signals/xau-tape";
import { computeBarTape } from "@/lib/market-signals/tape-method";

export type MetalLiqCoin = "XAU" | "XAG";

export type MetalLiqBook = {
  coin: MetalLiqCoin;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spread_bps: number;
  bid_sz: number;
  ask_sz: number;
  bid_usd: number;
  ask_usd: number;
  venue: "XAUUSDT" | "XAGUSDT";
};

export type MetalLiqTape = {
  coin: MetalLiqCoin;
  venue: "metal";
  vwap: number | null;
  vwap_pct: number | null;
  poc: number | null;
  vah: number | null;
  val: number | null;
  range_low: number | null;
  range_high: number | null;
  range_pos: number | null;
  cvd: number | null;
  delta_30m: number | null;
  buy_share: number | null;
  bid_wall_px: number | null;
  bid_wall_usd: number | null;
  ask_wall_px: number | null;
  ask_wall_usd: number | null;
  depth_10bp_bid_usd: number | null;
  depth_10bp_ask_usd: number | null;
  funding: null;
  open_interest: null;
  bin_funding: null;
  bybit_funding: null;
  last_px: number | null;
  last_side: "buy" | "sell" | null;
  last_sz: number | null;
  slip_typical_usd: number | null;
  slip_window: string | null;
  source: string;
  as_of: string;
};

function shift(px: number | null | undefined, delta: number) {
  if (px == null || !Number.isFinite(px)) return null;
  return Math.round((px + delta) * 100) / 100;
}

function toBook(coin: MetalLiqCoin, book: GoldBookDepth, delta: number): MetalLiqBook {
  const bid = book.bids[0];
  const ask = book.asks[0];
  const bidPx = (bid?.px ?? book.mid) + delta;
  const askPx = (ask?.px ?? book.mid) + delta;
  const mid = (bidPx + askPx) / 2;
  const spread = askPx - bidPx;
  return {
    coin,
    bid: Math.round(bidPx * 100) / 100,
    ask: Math.round(askPx * 100) / 100,
    mid: Math.round(mid * 100) / 100,
    spread: Math.round(spread * 100) / 100,
    spread_bps: mid > 0 ? (spread / mid) * 10_000 : 0,
    bid_sz: bid?.sz ?? 0,
    ask_sz: ask?.sz ?? 0,
    bid_usd: bid?.usd ?? 0,
    ask_usd: ask?.usd ?? 0,
    venue: book.symbol,
  };
}

function mapLevels(book: GoldBookDepth | null, delta: number, n = 1000) {
  if (!book) return { bids: [] as GoldBookLevel[], asks: [] as GoldBookLevel[] };
  const shiftPx = (lvl: GoldBookLevel) => ({
    px: Math.round((lvl.px + delta) * 100) / 100,
    sz: lvl.sz,
    usd: lvl.usd,
  });
  return {
    bids: book.bids.slice(0, n).map(shiftPx),
    asks: book.asks.slice(0, n).map(shiftPx),
  };
}

function overlayBook(tape: MetalLiqTape, book: GoldBookDepth | null, delta: number, print?: {
  last_px: number | null;
  last_sz: number | null;
  last_side: "buy" | "sell" | null;
}): MetalLiqTape {
  return {
    ...tape,
    bid_wall_px: shift(book?.bid_wall_px, delta),
    bid_wall_usd: book?.bid_wall_usd ?? tape.bid_wall_usd,
    ask_wall_px: shift(book?.ask_wall_px, delta),
    ask_wall_usd: book?.ask_wall_usd ?? tape.ask_wall_usd,
    depth_10bp_bid_usd: book?.depth_10bp_bid_usd ?? tape.depth_10bp_bid_usd,
    depth_10bp_ask_usd: book?.depth_10bp_ask_usd ?? tape.depth_10bp_ask_usd,
    last_px: print?.last_px != null ? shift(print.last_px, delta) : tape.last_px,
    last_side: print?.last_side ?? tape.last_side,
    last_sz: print?.last_sz ?? tape.last_sz,
    as_of: new Date().toISOString(),
  };
}

type MetalLiqPack = {
  book: MetalLiqBook | null;
  tape: MetalLiqTape | null;
  levels: { bids: GoldBookLevel[]; asks: GoldBookLevel[] };
  prints: XauPrint[];
};

const TAPE_TTL_MS = 20_000;
const tapeCache = new Map<MetalLiqCoin, { tape: MetalLiqTape; at: number }>();

function emptyTape(coin: MetalLiqCoin, source: string, mark: number | null, tick: number): MetalLiqTape {
  return {
    coin,
    venue: "metal",
    ...computeBarTape([], mark, tick),
    funding: null,
    open_interest: null,
    bin_funding: null,
    bybit_funding: null,
    slip_typical_usd: null,
    slip_window: null,
    source,
    as_of: new Date().toISOString(),
    last_px: mark,
    last_side: null,
    last_sz: null,
    bid_wall_px: null,
    bid_wall_usd: null,
    ask_wall_px: null,
    ask_wall_usd: null,
    depth_10bp_bid_usd: null,
    depth_10bp_ask_usd: null,
  };
}

export async function fetchMetalLiquidity(
  coin: MetalLiqCoin,
  opts?: { fast?: boolean },
): Promise<MetalLiqPack | null> {
  const symbol = coin === "XAG" ? "XAGUSDT" : "XAUUSDT";
  const cached = tapeCache.get(coin);
  const freshTape = cached && Date.now() - cached.at < TAPE_TTL_MS ? cached.tape : null;

  if (opts?.fast) {
    const [book, prints] = await Promise.all([
      fetchGoldBookDepth(symbol).catch(() => null),
      coin === "XAU" ? fetchEmXauPrints().catch(() => []) : Promise.resolve([]),
    ]);
    const delta = 0;
    return {
      book: book ? toBook(coin, book, delta) : null,
      tape: freshTape,
      levels: mapLevels(book, delta),
      prints,
    };
  }

  if (coin === "XAG") {
    const book = await fetchGoldBookDepth("XAGUSDT").catch(() => null);
    const tapeCore = freshTape ?? emptyTape("XAG", book?.source ?? "no L2", null, 0.01);
    const tape = overlayBook(tapeCore, book, 0);
    if (!freshTape) tapeCache.set(coin, { tape, at: Date.now() });
    return { book: book ? toBook("XAG", book, 0) : null, tape, levels: mapLevels(book, 0), prints: [] };
  }

  const [chart, quote, book, prints] = await Promise.all([
    freshTape ? Promise.resolve(null) : fetchGoldOhlc("1m", "1d").catch(() => null),
    fetchGoldSpotQuote().catch(() => null),
    fetchGoldBookDepth("XAUUSDT").catch(() => null),
    fetchEmXauPrints().catch(() => []),
  ]);
  const mark = quote?.price ?? chart?.bars.at(-1)?.close ?? freshTape?.last_px ?? null;
  if (mark == null && !book && !freshTape) return null;
  const delta = mark != null && book ? mark - book.mid : 0;
  const tapeCore = freshTape ?? {
    coin: "XAU" as const,
    venue: "metal" as const,
    ...computeBarTape(chart?.bars ?? [], mark, 0.5),
    funding: null,
    open_interest: null,
    bin_funding: null,
    bybit_funding: null,
    slip_typical_usd: null,
    slip_window: null,
    source: `${chart?.source ?? "gold bars"} · ${book?.source ?? "no L2"} · walls mapped onto XAUUSD`,
    as_of: new Date().toISOString(),
    last_px: mark,
    last_side: null as "buy" | "sell" | null,
    last_sz: null as number | null,
    bid_wall_px: null as number | null,
    bid_wall_usd: null as number | null,
    ask_wall_px: null as number | null,
    ask_wall_usd: null as number | null,
    depth_10bp_bid_usd: null as number | null,
    depth_10bp_ask_usd: null as number | null,
  };
  const tape = overlayBook(tapeCore, book, delta);
  if (!freshTape) tapeCache.set(coin, { tape, at: Date.now() });
  return { book: book ? toBook("XAU", book, delta) : null, tape, levels: mapLevels(book, delta), prints };
}
