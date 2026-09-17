import "server-only";

import { hlInfo } from "@/lib/hyperliquid/client";

export type HlBookQuote = {
  coin: "ETH" | "BTC";
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spread_bps: number;
  bid_sz: number;
  ask_sz: number;
  bid_usd: number;
  ask_usd: number;
  as_of: string;
};

type L2Level = { px?: string; sz?: string };
type L2Book = { levels?: [L2Level[], L2Level[]] };

const TTL_MS = 2_000;
const cache = new Map<string, { quote: HlBookQuote; at: number }>();
const inflight = new Map<string, Promise<HlBookQuote | null>>();

export async function fetchHlBook(coin: "ETH" | "BTC"): Promise<HlBookQuote | null> {
  const now = Date.now();
  const hit = cache.get(coin);
  if (hit && now - hit.at < TTL_MS) return hit.quote;
  const pending = inflight.get(coin);
  if (pending) return pending;
  const job = (async () => {
    try {
      const raw = await hlInfo<L2Book>({ type: "l2Book", coin });
      const bids = raw.levels?.[0] ?? [];
      const asks = raw.levels?.[1] ?? [];
      const bid = Number(bids[0]?.px);
      const ask = Number(asks[0]?.px);
      const bid_sz = Number(bids[0]?.sz);
      const ask_sz = Number(asks[0]?.sz);
      if (!Number.isFinite(bid) || !Number.isFinite(ask) || ask <= 0) return hit?.quote ?? null;
      const mid = (bid + ask) / 2;
      const quote: HlBookQuote = {
        coin,
        bid,
        ask,
        mid,
        spread: ask - bid,
        spread_bps: ((ask - bid) / mid) * 10_000,
        bid_sz: Number.isFinite(bid_sz) ? bid_sz : 0,
        ask_sz: Number.isFinite(ask_sz) ? ask_sz : 0,
        bid_usd: Number.isFinite(bid_sz) ? bid * bid_sz : 0,
        ask_usd: Number.isFinite(ask_sz) ? ask * ask_sz : 0,
        as_of: new Date().toISOString(),
      };
      cache.set(coin, { quote, at: Date.now() });
      return quote;
    } catch {
      return hit?.quote ?? null;
    } finally {
      inflight.delete(coin);
    }
  })();
  inflight.set(coin, job);
  return job;
}

export async function fetchEthDayRange(): Promise<{ low: number; high: number } | null> {
  const endTime = Date.now();
  const startTime = endTime - 86_400_000;
  try {
    const rows = await hlInfo<Array<{ h?: string; l?: string }>>({
      type: "candleSnapshot",
      req: { coin: "ETH", interval: "1h", startTime, endTime },
    });
    if (!Array.isArray(rows) || !rows.length) return null;
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const h = Number(row.h);
      const l = Number(row.l);
      if (Number.isFinite(h)) high = Math.max(high, h);
      if (Number.isFinite(l)) low = Math.min(low, l);
    }
    if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0) return null;
    return { low, high };
  } catch {
    return null;
  }
}
