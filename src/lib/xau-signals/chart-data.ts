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
const FRESH_MS = 20_000;
const chartInflight = new Map<string, Promise<ChartPayload>>();
const chartRefresh = new Map<string, Promise<void>>();

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
  const key = `${interval}:${range ?? ""}`;
  const existing = chartInflight.get(key);
  if (existing) return existing;
  const pending = loadXauOhlc(interval, range).finally(() => {
    chartInflight.delete(key);
  });
  chartInflight.set(key, pending);
  return pending;
}

async function loadXauOhlc(
  interval: GoldChartInterval,
  range?: GoldChartRange,
): Promise<ChartPayload> {
  const yahooRange = resolveChartRange(interval, range);
  const key = `${interval}:${range ?? ""}`;
  const meta = {
    symbol: "XAUUSDT" as const,
    interval,
    range: yahooRange,
    library: "lightweight-charts",
  };

  const cached = await readBarsCache(interval);
  const age = cacheAgeMs(cached);
  if (cached?.bars.length && age != null && age < FRESH_MS) {
    return { bars: cached.bars, source: cached.source, ...meta };
  }

  if (cached?.bars.length && age != null && age < CACHE_MAX_AGE_MS) {
    const refreshKey = `refresh:${key}`;
    if (!chartRefresh.has(refreshKey)) {
      const pending = (async () => {
        const exchange = await fetchExchangeOhlc(interval, yahooRange);
        if (!exchange?.bars.length) return;
        const bars = interval === "4h" ? aggregateBars(exchange.bars, 4 * 3600) : exchange.bars;
        await writeBarsCache(interval, bars, exchange.source);
      })().finally(() => {
        chartRefresh.delete(refreshKey);
      });
      chartRefresh.set(refreshKey, pending);
    }
    return {
      bars: cached.bars,
      source: `${cached.source} (cached)`,
      stale: true,
      ...meta,
    };
  }

  const exchange = await fetchExchangeOhlc(interval, yahooRange);
  if (exchange?.bars.length) {
    const bars = interval === "4h" ? aggregateBars(exchange.bars, 4 * 3600) : exchange.bars;
    await writeBarsCache(interval, bars, exchange.source);
    return { bars, source: exchange.source, ...meta };
  }

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
