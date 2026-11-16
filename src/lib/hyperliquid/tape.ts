import "server-only";

import { hlInfo } from "@/lib/hyperliquid/client";
import type { HlBookQuote } from "@/lib/hyperliquid/book";
import { fetchHlEthQuote, fetchHlSpotQuote } from "@/lib/hyperliquid/price";
import { computeBarTape, formatBarTape } from "@/lib/market-signals/tape-method";

type PerpQuote = { price: number; funding: number | null; open_interest: number | null };

/** Mark/funding for coins that do not have a dedicated quote helper (SOL, XRP, …). */
async function fetchHlPerpQuote(coin: string): Promise<PerpQuote | null> {
  try {
    const [meta, ctxs] = await hlInfo<
      [{ universe?: Array<{ name?: string }> }, Array<{ markPx?: string; midPx?: string; funding?: string; openInterest?: string }>]
    >({ type: "metaAndAssetCtxs" });
    const idx = meta.universe?.findIndex((u) => u.name === coin) ?? -1;
    const ctx = idx >= 0 ? ctxs[idx] : undefined;
    const price = Number(ctx?.markPx ?? ctx?.midPx);
    if (!Number.isFinite(price) || price <= 0) return null;
    const funding = Number(ctx?.funding);
    const openInterest = Number(ctx?.openInterest);
    return {
      price,
      funding: Number.isFinite(funding) ? funding : null,
      open_interest: Number.isFinite(openInterest) ? openInterest : null,
    };
  } catch {
    return null;
  }
}

export type HlTapeCoin = "ETH" | "BTC" | "SOL" | "XRP";

export type HlTape = {
  coin: HlTapeCoin;
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
  funding: number | null;
  open_interest: number | null;
  bin_funding: number | null;
  bybit_funding: number | null;
  last_px: number | null;
  last_side: "buy" | "sell" | null;
  last_sz: number | null;
  as_of: string;
};

type HlCandle = { t?: number; o?: string; h?: string; l?: string; c?: string; v?: string };
type L2Level = { px?: string; sz?: string };
type L2Book = { levels?: [L2Level[], L2Level[]] };

type HlTrade = { px?: string; sz?: string; side?: string; time?: number };
type PredFunding = [string, Array<[string, { fundingRate?: string } | null]>];

const FUNDING_TTL_MS = 20_000;
let fundingCache: { at: number; rows: PredFunding[] } | null = null;
let fundingInflight: Promise<PredFunding[]> | null = null;

async function predictedFundings(): Promise<PredFunding[]> {
  const now = Date.now();
  if (fundingCache && now - fundingCache.at < FUNDING_TTL_MS) return fundingCache.rows;
  if (fundingInflight) return fundingInflight;
  fundingInflight = (async () => {
    try {
      const rows = await hlInfo<PredFunding[]>({ type: "predictedFundings" });
      const list = Array.isArray(rows) ? rows : [];
      fundingCache = { at: Date.now(), rows: list };
      return list;
    } catch {
      return fundingCache?.rows ?? [];
    } finally {
      fundingInflight = null;
    }
  })();
  return fundingInflight;
}

function venueFunding(rows: PredFunding[], coin: string, venue: string) {
  const pack = rows.find((row) => row[0] === coin)?.[1] ?? [];
  const hit = pack.find((item) => item[0] === venue)?.[1];
  const n = Number(hit?.fundingRate);
  return Number.isFinite(n) ? n : null;
}

const TTL_MS = 8_000;
const cache = new Map<string, { tape: HlTape; at: number }>();
const inflight = new Map<string, Promise<HlTape | null>>();

function tickSize(coin: HlTapeCoin) {
  if (coin === "BTC") return 10;
  if (coin === "ETH") return 1;
  if (coin === "SOL") return 0.01;
  return 0.001;
}

function walls(book: HlBookQuote | null, raw: L2Book | null) {
  const bids = raw?.levels?.[0] ?? [];
  const asks = raw?.levels?.[1] ?? [];
  const mid = book?.mid ?? (Number(bids[0]?.px) + Number(asks[0]?.px)) / 2;
  let bidWallPx: number | null = null;
  let bidWallUsd = 0;
  let askWallPx: number | null = null;
  let askWallUsd = 0;
  let depthBid = 0;
  let depthAsk = 0;
  for (const lvl of bids) {
    const px = Number(lvl.px);
    const sz = Number(lvl.sz);
    if (!Number.isFinite(px) || !Number.isFinite(sz)) continue;
    const usd = px * sz;
    if (usd > bidWallUsd) {
      bidWallUsd = usd;
      bidWallPx = px;
    }
    if (mid > 0 && (mid - px) / mid <= 0.001) depthBid += usd;
  }
  for (const lvl of asks) {
    const px = Number(lvl.px);
    const sz = Number(lvl.sz);
    if (!Number.isFinite(px) || !Number.isFinite(sz)) continue;
    const usd = px * sz;
    if (usd > askWallUsd) {
      askWallUsd = usd;
      askWallPx = px;
    }
    if (mid > 0 && (px - mid) / mid <= 0.001) depthAsk += usd;
  }
  return {
    bid_wall_px: bidWallPx,
    bid_wall_usd: bidWallUsd || null,
    ask_wall_px: askWallPx,
    ask_wall_usd: askWallUsd || null,
    depth_10bp_bid_usd: depthBid || null,
    depth_10bp_ask_usd: depthAsk || null,
  };
}

export function formatTapeNotes(tape: HlTape | null) {
  if (!tape) return "TAPE: unavailable";
  const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
  const fund = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(4)}%`);
  const extra = [
    `bid wall ${tape.bid_wall_px ?? "—"} ${usd(tape.bid_wall_usd)} · ask wall ${tape.ask_wall_px ?? "—"} ${usd(tape.ask_wall_usd)} · 10bp ${usd(tape.depth_10bp_bid_usd)} / ${usd(tape.depth_10bp_ask_usd)}`,
    `funding HL ${fund(tape.funding)} · Binance ${fund(tape.bin_funding)} · Bybit ${fund(tape.bybit_funding)} · OI ${tape.open_interest == null ? "—" : Math.round(tape.open_interest)}`,
    `last print ${tape.last_side ?? "—"} ${tape.last_px ?? "—"} sz ${tape.last_sz ?? "—"} · Hyperliquid tape, not Bookmap`,
  ];
  return formatBarTape(tape.coin, tape, extra);
}

export async function fetchHlTape(
  coin: HlTapeCoin,
  book?: HlBookQuote | null,
): Promise<HlTape | null> {
  const now = Date.now();
  const hit = cache.get(coin);
  if (hit && now - hit.at < TTL_MS) return hit.tape;
  const pending = inflight.get(coin);
  if (pending) return pending;
  const job = (async () => {
    try {
      const endTime = Date.now();
      const startTime = endTime - 86_400_000;
      const [candles, rawBook, quote, trades, fundings] = await Promise.all([
        hlInfo<HlCandle[]>({
          type: "candleSnapshot",
          req: { coin, interval: "5m", startTime, endTime },
        }).catch(() => [] as HlCandle[]),
        book ? Promise.resolve(null) : hlInfo<L2Book>({ type: "l2Book", coin }).catch(() => null),
        coin === "ETH"
          ? fetchHlEthQuote().catch(() => null)
          : coin === "BTC"
            ? fetchHlSpotQuote().catch(() => null)
            : fetchHlPerpQuote(coin).catch(() => null),
        hlInfo<HlTrade[]>({ type: "recentTrades", coin }).catch(() => [] as HlTrade[]),
        predictedFundings(),
      ]);
      const rows = (Array.isArray(candles) ? candles : []).map((row) => ({
        high: Number(row.h),
        low: Number(row.l),
        close: Number(row.c),
        volume: Number(row.v),
      }));
      const mark = book?.mid ?? quote?.price ?? null;
      const bar = computeBarTape(rows, mark, tickSize(coin));
      const wall = walls(book ?? null, rawBook);
      const print = (Array.isArray(trades) ? trades : [])[0];
      const lastPx = Number(print?.px);
      const lastSz = Number(print?.sz);
      const tape: HlTape = {
        coin,
        ...bar,
        ...wall,
        funding: quote?.funding ?? venueFunding(fundings, coin, "HlPerp"),
        open_interest: quote?.open_interest ?? null,
        bin_funding: venueFunding(fundings, coin, "BinPerp"),
        bybit_funding: venueFunding(fundings, coin, "BybitPerp"),
        last_px: Number.isFinite(lastPx) ? lastPx : null,
        last_side: print?.side === "A" ? "buy" : print?.side === "B" ? "sell" : null,
        last_sz: Number.isFinite(lastSz) ? lastSz : null,
        as_of: new Date().toISOString(),
      };
      cache.set(coin, { tape, at: Date.now() });
      return tape;
    } catch {
      return hit?.tape ?? null;
    } finally {
      inflight.delete(coin);
    }
  })();
  inflight.set(coin, job);
  return job;
}
