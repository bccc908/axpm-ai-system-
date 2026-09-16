import "server-only";

export interface GoldSpotQuote {
  symbol: "XAUUSD";
  price: number;
  change_pct: number | null;
  as_of: string;
  source: string;
}

const QUOTE_TTL_MS = 2_000;
const QUOTE_STALE_MS = 60_000;
let quoteInflight: Promise<GoldSpotQuote | null> | null = null;
let quoteCache: { quote: GoldSpotQuote; at: number } | null = null;

function refreshGoldSpotQuote(): Promise<GoldSpotQuote | null> {
  if (quoteInflight) return quoteInflight;
  quoteInflight = (async () => {
    try {
      const yahoo = await fetchYahooSpot();
      const quote = yahoo ?? (await fetchGoldPriceDevSpot());
      if (quote) quoteCache = { quote, at: Date.now() };
      return quote ?? quoteCache?.quote ?? null;
    } finally {
      quoteInflight = null;
    }
  })();
  return quoteInflight;
}

/** Best-effort spot from COMEX GC=F (Yahoo) — no API key. */
export async function fetchGoldSpotQuote(): Promise<GoldSpotQuote | null> {
  const now = Date.now();
  if (quoteCache && now - quoteCache.at < QUOTE_TTL_MS) return quoteCache.quote;
  if (quoteCache && now - quoteCache.at < QUOTE_STALE_MS) {
    void refreshGoldSpotQuote();
    return quoteCache.quote;
  }
  return refreshGoldSpotQuote();
}

async function fetchYahooSpot(): Promise<GoldSpotQuote | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
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

async function fetchGoldPriceDevSpot(): Promise<GoldSpotQuote | null> {
  try {
    const res = await fetch("https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      symbols?: Array<{ price?: string; bid?: string; ask?: string }>;
    };
    const row = data.symbols?.[0];
    const price = Number(row?.price ?? row?.bid ?? row?.ask);
    if (!Number.isFinite(price)) return null;
    return {
      symbol: "XAUUSD",
      price: Math.round(price * 100) / 100,
      change_pct: null,
      as_of: new Date().toISOString(),
      source: "XAU-USD-SPOT",
    };
  } catch {
    return null;
  }
}
