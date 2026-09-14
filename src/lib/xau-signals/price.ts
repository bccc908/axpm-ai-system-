import "server-only";

import { fetchExchangeSpot } from "@/lib/xau-signals/binance-fetch";

export interface XauSpotQuote {
  symbol: "XAUUSDT";
  price: number;
  change_pct: number | null;
  as_of: string;
  source: string;
}

/** Binance / OKX / Bybit XAUUSDT — no Yahoo (GC=F is a different market). */
export async function fetchXauSpotQuote(): Promise<XauSpotQuote | null> {
  const exchange = await fetchExchangeSpot();
  if (!exchange) return null;
  return {
    symbol: "XAUUSDT",
    price: exchange.price,
    change_pct: exchange.change_pct,
    as_of: new Date().toISOString(),
    source: exchange.source,
  };
}
