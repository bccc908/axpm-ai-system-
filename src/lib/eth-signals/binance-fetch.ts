import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import type { GoldChartInterval, GoldChartRange } from "@/lib/gold-signals/chart-data";

const BINANCE_INTERVAL: Record<GoldChartInterval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
};

const OKX_BAR: Record<GoldChartInterval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
};

const BYBIT_INTERVAL: Record<GoldChartInterval, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
};

function barLimit(interval: GoldChartInterval, range: GoldChartRange): number {
  const barsPerDay: Record<GoldChartInterval, number> = {
    "1m": 1440,
    "5m": 288,
    "15m": 96,
    "1h": 24,
    "4h": 6,
  };
  const days: Record<GoldChartRange, number> = {
    "1d": 1,
    "5d": 5,
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    max: 730,
  };
  return Math.min(1000, Math.max(24, Math.ceil(barsPerDay[interval] * days[range])));
}

function parseBars(
  rows: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>,
): GoldOhlcBar[] {
  return rows
    .filter((r) => Number.isFinite(r.open + r.high + r.low + r.close))
    .map((r) => ({
      time: r.time,
      open: Math.round(r.open * 100) / 100,
      high: Math.round(r.high * 100) / 100,
      low: Math.round(r.low * 100) / 100,
      close: Math.round(r.close * 100) / 100,
      volume: Math.round(r.volume),
    }))
    .sort((a, b) => a.time - b.time);
}

async function fetchBinanceKlines(
  interval: GoldChartInterval,
  range: GoldChartRange,
): Promise<GoldOhlcBar[] | null> {
  const limit = barLimit(interval, range);
  const hosts = ["https://api.binance.com", "https://api1.binance.com", "https://data-api.binance.vision"];

  for (const host of hosts) {
    try {
      const res = await fetch(
        `${host}/api/v3/klines?symbol=ETHUSDT&interval=${BINANCE_INTERVAL[interval]}&limit=${limit}`,
        { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<[number, string, string, string, string, string, ...unknown[]]>;
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const bars = parseBars(
        rows.map((row) => ({
          time: Math.floor(row[0] / 1000),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
        })),
      );
      if (bars.length > 0) return bars;
    } catch {
      /* next host */
    }
  }
  return null;
}

async function fetchOkxKlines(
  interval: GoldChartInterval,
  range: GoldChartRange,
): Promise<GoldOhlcBar[] | null> {
  const limit = Math.min(300, barLimit(interval, range));
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/market/candles?instId=ETH-USDT&bar=${OKX_BAR[interval]}&limit=${limit}`,
      { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      code?: string;
      data?: Array<[string, string, string, string, string, string, ...string[]]>;
    };
    if (payload.code !== "0" || !payload.data?.length) return null;
    const bars = parseBars(
      payload.data.map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      })),
    );
    return bars.length > 0 ? bars : null;
  } catch {
    return null;
  }
}

async function fetchBybitKlines(
  interval: GoldChartInterval,
  range: GoldChartRange,
): Promise<GoldOhlcBar[] | null> {
  const limit = Math.min(1000, barLimit(interval, range));
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=ETHUSDT&interval=${BYBIT_INTERVAL[interval]}&limit=${limit}`,
      { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      retCode?: number;
      result?: { list?: Array<[string, string, string, string, string, string, string]> };
    };
    if (payload.retCode !== 0 || !payload.result?.list?.length) return null;
    const bars = parseBars(
      payload.result.list.map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      })),
    );
    return bars.length > 0 ? bars : null;
  } catch {
    return null;
  }
}

/** Real ETH/USDT klines — tries Binance, OKX, Bybit when Yahoo is blocked. */
export async function fetchExchangeOhlc(
  interval: GoldChartInterval,
  range: GoldChartRange,
): Promise<{ bars: GoldOhlcBar[]; source: string } | null> {
  const binance = await fetchBinanceKlines(interval, range);
  if (binance?.length) return { bars: binance, source: "Binance ETHUSDT" };

  const okx = await fetchOkxKlines(interval, range);
  if (okx?.length) return { bars: okx, source: "OKX ETH-USDT" };

  const bybit = await fetchBybitKlines(interval, range);
  if (bybit?.length) return { bars: bybit, source: "Bybit ETHUSDT" };

  return null;
}

/** Spot price from exchange tickers. */
export async function fetchExchangeSpot(): Promise<{
  price: number;
  change_pct: number | null;
  source: string;
} | null> {
  const sources: Array<() => Promise<{ price: number; change_pct: number | null; source: string } | null>> = [
    async () => {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT", {
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) return null;
        const d = (await res.json()) as { price?: string };
        const price = Number(d.price);
        if (!Number.isFinite(price)) return null;
        return { price: Math.round(price * 100) / 100, change_pct: null, source: "Binance ETHUSDT" };
      } catch {
        return null;
      }
    },
    async () => {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT", {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return null;
        const d = (await res.json()) as { lastPrice?: string; priceChangePercent?: string };
        const price = Number(d.lastPrice);
        if (!Number.isFinite(price)) return null;
        const change = Number(d.priceChangePercent);
        return {
          price: Math.round(price * 100) / 100,
          change_pct: Number.isFinite(change) ? Math.round(change * 100) / 100 : null,
          source: "Binance ETHUSDT",
        };
      } catch {
        return null;
      }
    },
    async () => {
      try {
        const res = await fetch("https://www.okx.com/api/v5/market/ticker?instId=ETH-USDT", {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return null;
        const d = (await res.json()) as { data?: Array<{ last?: string; open24h?: string }> };
        const row = d.data?.[0];
        const price = Number(row?.last);
        if (!Number.isFinite(price)) return null;
        const open = Number(row?.open24h);
        const change_pct =
          Number.isFinite(open) && open > 0 ? Math.round(((price - open) / open) * 10000) / 100 : null;
        return { price: Math.round(price * 100) / 100, change_pct, source: "OKX ETH-USDT" };
      } catch {
        return null;
      }
    },
    async () => {
      try {
        const res = await fetch(
          "https://api.bybit.com/v5/market/tickers?category=spot&symbol=ETHUSDT",
          { cache: "no-store", signal: AbortSignal.timeout(8_000) },
        );
        if (!res.ok) return null;
        const d = (await res.json()) as {
          result?: { list?: Array<{ lastPrice?: string; price24hPcnt?: string }> };
        };
        const row = d.result?.list?.[0];
        const price = Number(row?.lastPrice);
        if (!Number.isFinite(price)) return null;
        const change = Number(row?.price24hPcnt) * 100;
        return {
          price: Math.round(price * 100) / 100,
          change_pct: Number.isFinite(change) ? Math.round(change * 100) / 100 : null,
          source: "Bybit ETHUSDT",
        };
      } catch {
        return null;
      }
    },
  ];

  for (const fn of sources) {
    const hit = await fn();
    if (hit) return hit;
  }
  return null;
}
