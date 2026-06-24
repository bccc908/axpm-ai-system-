import "server-only";

export interface GoldSpotQuote {
  symbol: "XAUUSD";
  price: number;
  change_pct: number | null;
  as_of: string;
  source: string;
}

/** Best-effort spot from COMEX GC=F (Yahoo) — no API key. */
export async function fetchGoldSpotQuote(): Promise<GoldSpotQuote | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 SignalFlag/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
        }>;
      };
    };

    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price)) return null;

    const prev = meta?.chartPreviousClose;
    const change_pct =
      typeof prev === "number" && prev > 0 ? ((price - prev) / prev) * 100 : null;

    return {
      symbol: "XAUUSD",
      price: Math.round(price * 100) / 100,
      change_pct: change_pct != null ? Math.round(change_pct * 100) / 100 : null,
      as_of: new Date().toISOString(),
      source: "GC=F",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
