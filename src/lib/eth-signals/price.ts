import "server-only";

import { fetchExchangeSpot } from "@/lib/eth-signals/binance-fetch";
import { BROWSER_UA, getYahooSession, yahooChartHeaders } from "@/lib/gold-signals/yahoo-session";

export interface EthSpotQuote {
  symbol: "ETHUSD";
  price: number;
  change_pct: number | null;
  as_of: string;
  source: string;
}

/** Best-effort ETH spot — exchanges first (Yahoo often blocked in CN). */
export async function fetchEthSpotQuote(): Promise<EthSpotQuote | null> {
  const exchange = await fetchExchangeSpot();
  if (exchange) {
    return {
      symbol: "ETHUSD",
      price: exchange.price,
      change_pct: exchange.change_pct,
      as_of: new Date().toISOString(),
      source: exchange.source,
    };
  }
  const yahoo = await fetchYahooSpot();
  if (yahoo) return yahoo;
  return fetchCoinGeckoSpot();
}

async function fetchYahooSpot(): Promise<EthSpotQuote | null> {
  const session = await getYahooSession();
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

  for (const host of hosts) {
    const base = `https://${host}/v8/finance/chart/ETH-USD?interval=1m&range=1d`;
    const url = session ? `${base}&crumb=${encodeURIComponent(session.crumb)}` : base;
    const headers = session
      ? yahooChartHeaders(session)
      : { "User-Agent": BROWSER_UA, Accept: "application/json,text/plain,*/*" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trimStart().startsWith("<!")) continue;

      const data = JSON.parse(text) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
          }>;
        };
      };

      const meta = data.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      if (typeof price !== "number" || !Number.isFinite(price)) continue;

      const prev = meta?.chartPreviousClose;
      const change_pct =
        typeof prev === "number" && prev > 0 ? ((price - prev) / prev) * 100 : null;

      return {
        symbol: "ETHUSD",
        price: Math.round(price * 100) / 100,
        change_pct: change_pct != null ? Math.round(change_pct * 100) / 100 : null,
        as_of: new Date().toISOString(),
        source: "ETH-USD",
      };
    } catch {
      /* try next host */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function fetchCoinGeckoSpot(): Promise<EthSpotQuote | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true",
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ethereum?: { usd?: number; usd_24h_change?: number };
    };
    const price = data.ethereum?.usd;
    if (typeof price !== "number" || !Number.isFinite(price)) return null;
    const change = data.ethereum?.usd_24h_change;
    return {
      symbol: "ETHUSD",
      price: Math.round(price * 100) / 100,
      change_pct: typeof change === "number" ? Math.round(change * 100) / 100 : null,
      as_of: new Date().toISOString(),
      source: "CoinGecko",
    };
  } catch {
    return null;
  }
}
