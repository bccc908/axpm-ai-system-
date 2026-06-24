import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";

export type { GoldOhlcBar };
export type GoldChartInterval = "1m" | "5m" | "15m" | "1h" | "4h";

const YAHOO_INTERVAL: Record<GoldChartInterval, { interval: string; range: string }> = {
  "1m": { interval: "1m", range: "1d" },
  "5m": { interval: "5m", range: "5d" },
  "15m": { interval: "15m", range: "5d" },
  "1h": { interval: "60m", range: "1mo" },
  "4h": { interval: "60m", range: "3mo" },
};

export async function fetchGoldOhlc(interval: GoldChartInterval = "5m"): Promise<{
  bars: GoldOhlcBar[];
  symbol: string;
  source: string;
}> {
  const cfg = YAHOO_INTERVAL[interval];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${cfg.interval}&range=${cfg.range}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 SignalFlag/1.0" },
      signal: controller.signal,
      ...(interval === "1m"
        ? { cache: "no-store" as const }
        : { next: { revalidate: 60 } }),
    });
    if (!res.ok) throw new Error(`yahoo ${res.status}`);

    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }>;
          };
        }>;
      };
    };

    const result = data.chart?.result?.[0];
    const ts = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0];
    if (!q) return { bars: [], symbol: "XAUUSD", source: "GC=F" };

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

    // 4h: aggregate hourly bars
    if (interval === "4h") {
      return { bars: aggregateBars(bars, 4 * 3600), symbol: "XAUUSD", source: "GC=F" };
    }

    return { bars, symbol: "XAUUSD", source: "GC=F" };
  } finally {
    clearTimeout(timer);
  }
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
