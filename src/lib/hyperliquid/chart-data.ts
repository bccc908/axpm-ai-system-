import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import {
  type GoldChartInterval,
  type GoldChartRange,
  resolveChartRange,
} from "@/lib/gold-signals/chart-data";
import { HL_COIN, hlInfo } from "@/lib/hyperliquid/client";
import { cacheAgeMs, readBarsCache, writeBarsCache } from "@/lib/hyperliquid/bars-cache";

export type { GoldChartInterval, GoldChartRange };

const FRESH_MS = 15_000;
const CACHE_MAX_AGE_MS = 30 * 60_000;
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

type HlCandle = {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
};

const RANGE_MS: Record<GoldChartRange, number> = {
  "1d": 1 * 86_400_000,
  "5d": 5 * 86_400_000,
  "1mo": 30 * 86_400_000,
  "3mo": 90 * 86_400_000,
  "6mo": 180 * 86_400_000,
  "1y": 365 * 86_400_000,
  max: 365 * 86_400_000,
};

function parseCandles(rows: HlCandle[]): GoldOhlcBar[] {
  const bars: GoldOhlcBar[] = [];
  for (const row of rows) {
    const open = Number(row.o);
    const high = Number(row.h);
    const low = Number(row.l);
    const close = Number(row.c);
    const time = Math.floor(Number(row.t) / 1000);
    if (!Number.isFinite(open + high + low + close) || !time) continue;
    bars.push({
      time,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(Number(row.v) || 0),
    });
  }
  return bars;
}

async function fetchHlCandles(
  interval: GoldChartInterval,
  range: GoldChartRange,
): Promise<GoldOhlcBar[]> {
  const endTime = Date.now();
  const startTime = endTime - RANGE_MS[range];
  const rows = await hlInfo<HlCandle[]>({
    type: "candleSnapshot",
    req: { coin: HL_COIN, interval, startTime, endTime },
  });
  return Array.isArray(rows) ? parseCandles(rows) : [];
}

export async function fetchHlOhlc(
  interval: GoldChartInterval = "5m",
  range?: GoldChartRange,
): Promise<ChartPayload> {
  const key = `${interval}:${range ?? ""}`;
  const existing = chartInflight.get(key);
  if (existing) return existing;
  const pending = loadHlOhlc(interval, range).finally(() => {
    chartInflight.delete(key);
  });
  chartInflight.set(key, pending);
  return pending;
}

async function loadHlOhlc(
  interval: GoldChartInterval,
  range?: GoldChartRange,
): Promise<ChartPayload> {
  const hlRange = resolveChartRange(interval, range);
  const key = `${interval}:${range ?? ""}`;
  const meta = {
    symbol: "BTC-PERP" as const,
    interval,
    range: hlRange,
    library: "lightweight-charts",
  };

  const cached = await readBarsCache(interval);
  const age = cacheAgeMs(cached);
  if (cached?.bars.length && age != null && age < FRESH_MS) {
    return { bars: cached.bars, source: cached.source, ...meta };
  }

  if (cached?.bars.length && age != null && age < CACHE_MAX_AGE_MS) {
    if (!chartRefresh.has(key)) {
      const pending = (async () => {
        const bars = await fetchHlCandles(interval, hlRange);
        if (bars.length) await writeBarsCache(interval, bars, "Hyperliquid");
      })().finally(() => chartRefresh.delete(key));
      chartRefresh.set(key, pending);
    }
    return {
      bars: cached.bars,
      source: `${cached.source} (cached)`,
      stale: true,
      ...meta,
    };
  }

  const bars = await fetchHlCandles(interval, hlRange);
  if (bars.length) {
    await writeBarsCache(interval, bars, "Hyperliquid");
    return { bars, source: "Hyperliquid", ...meta };
  }
  if (cached?.bars.length) {
    return { bars: cached.bars, source: `${cached.source} (cached)`, stale: true, ...meta };
  }
  throw new Error("Hyperliquid chart unavailable");
}
