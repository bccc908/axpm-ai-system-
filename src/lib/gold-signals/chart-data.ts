import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import { cacheAgeMs, readBarsCache, writeBarsCache } from "@/lib/gold-signals/bars-cache";
import { fetchSpotFallbackBars } from "@/lib/gold-signals/spot-bars-fallback";
import { BROWSER_UA, getYahooSession, yahooChartHeaders } from "@/lib/gold-signals/yahoo-session";

export type { GoldOhlcBar };
export type GoldChartInterval = "1m" | "5m" | "15m" | "1h" | "4h";
export type GoldChartRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "max";

const YAHOO_INTERVAL: Record<GoldChartInterval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "60m",
  "4h": "60m",
};

const DEFAULT_RANGE: Record<GoldChartInterval, GoldChartRange> = {
  "1m": "1d",
  "5m": "5d",
  "15m": "5d",
  "1h": "1mo",
  "4h": "3mo",
};

const CACHE_MAX_AGE_MS = 30 * 60_000;
const FRESH_MS = 20_000;
const chartRefresh = new Map<string, Promise<void>>();

/** Yahoo caps intraday history — clamp range so requests succeed. */
export function resolveChartRange(
  interval: GoldChartInterval,
  range?: GoldChartRange,
): GoldChartRange {
  const pick = range ?? DEFAULT_RANGE[interval];
  if (interval === "1m") {
    if (pick === "1d" || pick === "5d") return pick;
    return "5d";
  }
  if (interval === "5m" || interval === "15m") {
    if (pick === "1d" || pick === "5d" || pick === "1mo") return pick;
    return "1mo";
  }
  return pick;
}

type ChartPayload = {
  bars: GoldOhlcBar[];
  symbol: string;
  source: string;
  interval: GoldChartInterval;
  range: GoldChartRange;
  library: string;
  stale?: boolean;
};

const chartInflight = new Map<string, Promise<ChartPayload>>();

function parseYahooChart(data: unknown): GoldOhlcBar[] {
  const result = (data as { chart?: { result?: Array<{
    timestamp?: number[];
    indicators?: { quote?: Array<{
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
      volume?: (number | null)[];
    }> };
  }> } }).chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0];
  if (!q) return [];

  const bars: GoldOhlcBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    const close = q.close?.[i];
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !Number.isFinite(open + high + low + close)
    ) {
      continue;
    }
    bars.push({
      time: ts[i],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round((q.volume?.[i] ?? 0) as number),
    });
  }
  return bars;
}

async function fetchYahooOhlc(
  interval: GoldChartInterval,
  yahooRange: GoldChartRange,
): Promise<GoldOhlcBar[] | null> {
  const yahooInterval = YAHOO_INTERVAL[interval];
  const session = await getYahooSession();
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

  try {
    return await Promise.any(
      hosts.map(async (host) => {
        const base = `https://${host}/v8/finance/chart/GC=F?interval=${yahooInterval}&range=${yahooRange}`;
        const url = session ? `${base}&crumb=${encodeURIComponent(session.crumb)}` : base;
        const headers = session
          ? yahooChartHeaders(session)
          : { "User-Agent": BROWSER_UA, Accept: "application/json,text/plain,*/*" };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8_000);
        try {
          const res = await fetch(url, {
            headers,
            signal: controller.signal,
            cache: interval === "1m" ? "no-store" : undefined,
            next: interval === "1m" ? undefined : { revalidate: 60 },
          });
          if (!res.ok) throw new Error("bad status");
          const text = await res.text();
          if (text.trimStart().startsWith("<!")) throw new Error("html");
          const bars = parseYahooChart(JSON.parse(text));
          if (bars.length === 0) throw new Error("empty");
          return bars;
        } finally {
          clearTimeout(timer);
        }
      }),
    );
  } catch {
    return null;
  }
}

async function resolveFallbackBars(interval: GoldChartInterval): Promise<ChartPayload | null> {
  const cached = await readBarsCache(interval);
  const age = cacheAgeMs(cached);
  if (cached && age != null && age < CACHE_MAX_AGE_MS) {
    return {
      bars: cached.bars,
      symbol: "XAUUSD",
      source: `${cached.source} (cached)`,
      interval,
      range: resolveChartRange(interval),
      library: "lightweight-charts",
      stale: true,
    };
  }

  const spot = await fetchSpotFallbackBars(interval === "1m" ? 120 : 72);
  if (!spot?.bars.length) return null;

  await writeBarsCache(interval, spot.bars, spot.source);

  return {
    bars: spot.bars,
    symbol: "XAUUSD",
    source: spot.source,
    interval,
    range: resolveChartRange(interval),
    library: "lightweight-charts",
    stale: true,
  };
}

export async function fetchGoldOhlc(
  interval: GoldChartInterval = "5m",
  range?: GoldChartRange,
): Promise<ChartPayload> {
  const key = `${interval}:${range ?? ""}`;
  const existing = chartInflight.get(key);
  if (existing) return existing;
  const pending = loadGoldOhlc(interval, range).finally(() => {
    chartInflight.delete(key);
  });
  chartInflight.set(key, pending);
  return pending;
}

async function loadGoldOhlc(
  interval: GoldChartInterval,
  range?: GoldChartRange,
): Promise<ChartPayload> {
  const yahooRange = resolveChartRange(interval, range);
  const key = `${interval}:${range ?? ""}`;
  const meta = {
    symbol: "XAUUSD" as const,
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
        const yahooBars = await fetchYahooOhlc(interval, yahooRange);
        if (!yahooBars?.length) return;
        const bars = interval === "4h" ? aggregateBars(yahooBars, 4 * 3600) : yahooBars;
        await writeBarsCache(interval, bars, "GC=F");
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

  const yahooBars = await fetchYahooOhlc(interval, yahooRange);
  if (yahooBars?.length) {
    const bars = interval === "4h" ? aggregateBars(yahooBars, 4 * 3600) : yahooBars;
    await writeBarsCache(interval, bars, "GC=F");
    return { bars, source: "GC=F", ...meta };
  }

  const fallback = await resolveFallbackBars(interval);
  if (fallback) return fallback;

  throw new Error("chart data unavailable (Yahoo blocked, no cache)");
}

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
