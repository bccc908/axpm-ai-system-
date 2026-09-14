import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import {
  type GoldChartInterval,
  type GoldChartRange,
  resolveChartRange,
} from "@/lib/gold-signals/chart-data";
import { cacheAgeMs, readBarsCache, writeBarsCache } from "@/lib/xau-signals/bars-cache";
import { fetchExchangeOhlc } from "@/lib/xau-signals/binance-fetch";
import { fetchSpotFallbackBars } from "@/lib/xau-signals/spot-bars-fallback";

export type { GoldChartInterval, GoldChartRange };

const CACHE_MAX_AGE_MS = 30 * 60_000;

type ChartPayload = {
  bars: GoldOhlcBar[];
  symbol: string;
  source: string;
  interval: GoldChartInterval;
  range: GoldChartRange;
  library: string;
  stale?: boolean;
};

function aggregateBars(bars: GoldOhlcBar[], bucketSec: number): GoldOhlcBar[] {
  if (bars.length === 0) return [];
  const out: GoldOhlcBar[] = [];
  let cur: GoldOhlcBar | null = null;
  let bucket = 0;

  for (const b of bars) {
    const bkt = Math.floor(b.time / bucketSec) * bucketSec;
    if (!cur || bkt !== bucket) {
      if (cur) out.push(cur);
      cur = { ...b, time: bkt };
      bucket = bkt;
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export async function fetchXauOhlc(
  interval: GoldChartInterval = "5m",
  range?: GoldChartRange,
): Promise<ChartPayload> {
  const yahooRange = resolveChartRange(interval, range);
  const meta = {
    symbol: "XAUUSDT" as const,
    interval,
    range: yahooRange,
    library: "lightweight-charts",
  };

  const exchange = await fetchExchangeOhlc(interval, yahooRange);
  if (exchange?.bars.length) {
    const bars = interval === "4h" ? aggregateBars(exchange.bars, 4 * 3600) : exchange.bars;
    await writeBarsCache(interval, bars, exchange.source);
    return { bars, source: exchange.source, ...meta };
  }

  const cached = await readBarsCache(interval);
  const age = cacheAgeMs(cached);
  if (cached?.bars.length) {
    const stale = age == null || age >= CACHE_MAX_AGE_MS;
    return {
      bars: cached.bars,
      source: stale ? `${cached.source} (cached)` : cached.source,
      stale,
      ...meta,
    };
  }

  const spot = await fetchSpotFallbackBars(interval === "1m" ? 120 : 72);
  if (spot?.bars.length) {
    await writeBarsCache(interval, spot.bars, spot.source);
    return { bars: spot.bars, source: spot.source, stale: true, ...meta };
  }

  throw new Error("chart data unavailable (Binance blocked, no cache)");
}
