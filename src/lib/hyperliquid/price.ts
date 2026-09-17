import "server-only";

import { HL_COIN, hlInfo } from "@/lib/hyperliquid/client";

export interface HlSpotQuote {
  symbol: "BTC-PERP" | "ETH-PERP";
  price: number;
  change_pct: number | null;
  funding: number | null;
  open_interest: number | null;
  as_of: string;
  source: string;
}

type AssetCtx = {
  markPx?: string;
  midPx?: string;
  prevDayPx?: string;
  funding?: string;
  openInterest?: string;
};

type MetaAndCtx = [
  { universe?: Array<{ name?: string }> },
  AssetCtx[],
];

const QUOTE_TTL_MS = 2_000;
const QUOTE_STALE_MS = 30_000;
let quoteInflight: Promise<HlSpotQuote | null> | null = null;
let quoteCache: { quote: HlSpotQuote; at: number } | null = null;

function refreshQuote(): Promise<HlSpotQuote | null> {
  if (quoteInflight) return quoteInflight;
  quoteInflight = (async () => {
    try {
      const quote = await fetchHlQuoteFresh();
      if (quote) quoteCache = { quote, at: Date.now() };
      return quote ?? quoteCache?.quote ?? null;
    } finally {
      quoteInflight = null;
    }
  })();
  return quoteInflight;
}

export async function fetchHlSpotQuote(): Promise<HlSpotQuote | null> {
  const now = Date.now();
  if (quoteCache && now - quoteCache.at < QUOTE_TTL_MS) return quoteCache.quote;
  if (quoteCache && now - quoteCache.at < QUOTE_STALE_MS) {
    void refreshQuote();
    return quoteCache.quote;
  }
  return refreshQuote();
}

async function fetchHlQuoteFresh(): Promise<HlSpotQuote | null> {
  const [meta, ctxs] = await hlInfo<MetaAndCtx>({ type: "metaAndAssetCtxs" });
  const idx = meta.universe?.findIndex((u) => u.name === HL_COIN) ?? -1;
  const ctx = idx >= 0 ? ctxs[idx] : undefined;
  const price = Number(ctx?.markPx ?? ctx?.midPx);
  if (!Number.isFinite(price) || price <= 0) return null;
  const prev = Number(ctx?.prevDayPx);
  const change_pct =
    Number.isFinite(prev) && prev > 0 ? Math.round(((price - prev) / prev) * 10000) / 100 : null;
  const funding = Number(ctx?.funding);
  const open_interest = Number(ctx?.openInterest);
  return {
    symbol: "BTC-PERP",
    price: Math.round(price * 100) / 100,
    change_pct,
    funding: Number.isFinite(funding) ? funding : null,
    open_interest: Number.isFinite(open_interest) ? open_interest : null,
    as_of: new Date().toISOString(),
    source: "Hyperliquid",
  };
}

let ethQuoteInflight: Promise<HlSpotQuote | null> | null = null;
let ethQuoteCache: { quote: HlSpotQuote; at: number } | null = null;

export async function fetchHlEthQuote(): Promise<HlSpotQuote | null> {
  const now = Date.now();
  if (ethQuoteCache && now - ethQuoteCache.at < QUOTE_TTL_MS) return ethQuoteCache.quote;
  if (ethQuoteCache && now - ethQuoteCache.at < QUOTE_STALE_MS) {
    void refreshEthQuote();
    return ethQuoteCache.quote;
  }
  return refreshEthQuote();
}

function refreshEthQuote(): Promise<HlSpotQuote | null> {
  if (ethQuoteInflight) return ethQuoteInflight;
  ethQuoteInflight = (async () => {
    try {
      const [meta, ctxs] = await hlInfo<MetaAndCtx>({ type: "metaAndAssetCtxs" });
      const idx = meta.universe?.findIndex((u) => u.name === "ETH") ?? -1;
      const ctx = idx >= 0 ? ctxs[idx] : undefined;
      const price = Number(ctx?.markPx ?? ctx?.midPx);
      if (!Number.isFinite(price) || price <= 0) return ethQuoteCache?.quote ?? null;
      const prev = Number(ctx?.prevDayPx);
      const change_pct =
        Number.isFinite(prev) && prev > 0 ? Math.round(((price - prev) / prev) * 10000) / 100 : null;
      const funding = Number(ctx?.funding);
      const open_interest = Number(ctx?.openInterest);
      const quote: HlSpotQuote = {
        symbol: "ETH-PERP",
        price: Math.round(price * 10) / 10,
        change_pct,
        funding: Number.isFinite(funding) ? funding : null,
        open_interest: Number.isFinite(open_interest) ? open_interest : null,
        as_of: new Date().toISOString(),
        source: "Hyperliquid",
      };
      ethQuoteCache = { quote, at: Date.now() };
      return quote;
    } finally {
      ethQuoteInflight = null;
    }
  })();
  return ethQuoteInflight;
}
