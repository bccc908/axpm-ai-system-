import "server-only";

import { fetchExchangeSpot } from "@/lib/xau-signals/binance-fetch";

export interface XauSpotQuote {
  symbol: "XAUUSDT";
  price: number;
  change_pct: number | null;
  as_of: string;
  source: string;
}

const QUOTE_TTL_MS = 2_000;
let quoteInflight: Promise<XauSpotQuote | null> | null = null;
let quoteCache: { quote: XauSpotQuote; at: number } | null = null;

/** Binance / OKX / Bybit XAUUSDT — no Yahoo (GC=F is a different market). */
export async function fetchXauSpotQuote(): Promise<XauSpotQuote | null> {
  if (quoteCache && Date.now() - quoteCache.at < QUOTE_TTL_MS) return quoteCache.quote;
  if (quoteInflight) return quoteInflight;
  quoteInflight = (async () => {
    try {
      const exchange = await fetchExchangeSpot();
      if (!exchange) return null;
      const quote: XauSpotQuote = {
        symbol: "XAUUSDT",
        price: exchange.price,
        change_pct: exchange.change_pct,
        as_of: new Date().toISOString(),
        source: exchange.source,
      };
      quoteCache = { quote, at: Date.now() };
      return quote;
    } finally {
      quoteInflight = null;
    }
  })();
  return quoteInflight;
}
