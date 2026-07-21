import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import {
  type GoldChartInterval,
  type GoldChartRange,
  resolveChartRange,
} from "@/lib/gold-signals/chart-data";
import { cacheAgeMs, readBarsCache, writeBarsCache } from "@/lib/btc-signals/bars-cache";
import { fetchExchangeOhlc } from "@/lib/btc-signals/binance-fetch";
import { fetchSpotFallbackBars } from "@/lib/btc-signals/spot-bars-fallback";
import { BROWSER_UA, getYahooSession, yahooChartHeaders } from "@/lib/gold-signals/yahoo-session";

export type { GoldChartInterval, GoldChartRange };

const YAHOO_INTERVAL: Record<GoldChartInterval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "60m",
  "4h": "60m",
};

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

  for (const host of hosts) {
    const base = `https://${host}/v8/finance/chart/BTC-USD?interval=${yahooInterval}&range=${yahooRange}`;
    const url = session ? `${base}&crumb=${encodeURIComponent(session.crumb)}` : base;
    const headers = session
      ? yahooChartHeaders(session)
      : { "User-Agent": BROWSER_UA, Accept: "application/json,text/plain,*/*" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
        cache: interval === "1m" ? "no-store" : undefined,
        next: interval === "1m" ? undefined : { revalidate: 60 },
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trimStart().startsWith("<!")) continue;
      const bars = parseYahooChart(JSON.parse(text));
      if (bars.length > 0) return bars;
    } catch {
      /* try next host */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function resolveFallbackBars(
  interval: GoldChartInterval,
  yahooRange: GoldChartRange,
): Promise<ChartPayload | null> {
  const exchange = await fetchExchangeOhlc(interval, yahooRange);
  if (exchange?.bars.length) {
    const bars = interval === "4h" ? aggregateBars(exchange.bars, 4 * 3600) : exchange.bars;
    await writeBarsCache(interval, bars, exchange.source);
    return {
      bars,
      symbol: "BTCUSD",
      source: exchange.source,
      interval,
      range: yahooRange,
      library: "lightweight-charts",
    };
  }

  const cached = await readBarsCache(interval);
  const age = cacheAgeMs(cached);
  if (cached?.bars.length) {
    const stale = age == null || age >= CACHE_MAX_AGE_MS;
    return {
      bars: cached.bars,
      symbol: "BTCUSD",
      source: stale ? `${cached.source} (cached)` : cached.source,
      interval,
      range: resolveChartRange(interval),
      library: "lightweight-charts",
      stale,
    };
  }

  const spot = await fetchSpotFallbackBars(interval === "1m" ? 120 : 72);
  if (!spot?.bars.length) return null;

  await writeBarsCache(interval, spot.bars, spot.source);

  return {
    bars: spot.bars,
    symbol: "BTCUSD",
    source: spot.source,
    interval,
    range: resolveChartRange(interval),
    library: "lightweight-charts",
    stale: true,
  };
}

export async function fetchBtcOhlc(
  interval: GoldChartInterval = "5m",
  range?: GoldChartRange,
): Promise<ChartPayload> {
  const yahooRange = resolveChartRange(interval, range);
  const meta = {
    symbol: "BTCUSD" as const,
    interval,
    range: yahooRange,
    library: "lightweight-charts",
  };

  const yahooBars = await fetchYahooOhlc(interval, yahooRange);
  if (yahooBars?.length) {
    const bars = interval === "4h" ? aggregateBars(yahooBars, 4 * 3600) : yahooBars;
    await writeBarsCache(interval, bars, "BTC-USD");
    return { bars, source: "BTC-USD", ...meta };
  }

  const fallback = await resolveFallbackBars(interval, yahooRange);
  if (fallback) return fallback;

  throw new Error("chart data unavailable (Yahoo/Binance blocked, no cache)");
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
