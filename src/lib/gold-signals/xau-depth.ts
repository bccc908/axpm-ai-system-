import "server-only";

import { fetch as undiciFetch, ProxyAgent } from "undici";
import { getProxyUrl, proxiedFetch } from "@/lib/ai/proxy-fetch";

export type GoldBookLevel = {
  px: number;
  sz: number;
  usd: number;
};

export type GoldBookDepth = {
  symbol: "XAUUSDT" | "XAGUSDT";
  mid: number;
  bids: GoldBookLevel[];
  asks: GoldBookLevel[];
  bid_wall_px: number | null;
  bid_wall_usd: number | null;
  ask_wall_px: number | null;
  ask_wall_usd: number | null;
  depth_10bp_bid_usd: number;
  depth_10bp_ask_usd: number;
  source: string;
  as_of: string;
};

export type GoldDepthSymbol = GoldBookDepth["symbol"];

const cache = new Map<GoldDepthSymbol, { book: GoldBookDepth; at: number }>();
const inflight = new Map<GoldDepthSymbol, Promise<GoldBookDepth | null>>();
const TTL_MS = 700;
const BOOK_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 AXPMGoldDesk/1.0",
} as const;
const LOCAL_PROXY_PORTS = [9527, 7890, 7891, 1087, 20171];
const LOCAL_PROXY_RETRY_MS = 20_000;
let localCexAgent: ProxyAgent | null | undefined;
let localCexAgentAt = 0;
let localCexAgentJob: Promise<ProxyAgent | null> | null = null;

async function resolveLocalCexAgent(): Promise<ProxyAgent | null> {
  if (localCexAgent) return localCexAgent;
  if (localCexAgent === null && Date.now() - localCexAgentAt < LOCAL_PROXY_RETRY_MS) {
    return null;
  }
  if (localCexAgentJob) return localCexAgentJob;
  localCexAgentJob = (async () => {
    for (const port of LOCAL_PROXY_PORTS) {
      try {
        const agent = new ProxyAgent(`http://127.0.0.1:${port}`);
        const ping = await undiciFetch("https://fapi.binance.com/fapi/v1/ping", {
          dispatcher: agent,
          headers: BOOK_HEADERS,
          signal: AbortSignal.timeout(1_500),
        });
        if (ping.ok) {
          localCexAgent = agent;
          localCexAgentAt = Date.now();
          return agent;
        }
      } catch {
        /* next port */
      }
    }
    localCexAgent = null;
    localCexAgentAt = Date.now();
    return null;
  })();
  try {
    return await localCexAgentJob;
  } finally {
    localCexAgentJob = null;
  }
}

async function bookFetch(url: string): Promise<Response> {
  const init: RequestInit = {
    headers: BOOK_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  };
  if (getProxyUrl()) return proxiedFetch(url, init);
  const agent = await resolveLocalCexAgent();
  if (agent) {
    return undiciFetch(url, {
      headers: BOOK_HEADERS,
      dispatcher: agent,
      signal: AbortSignal.timeout(4_000),
    }) as unknown as Response;
  }
  return fetch(url, init);
}

function toLevels(rows: Array<[string, string]>, n = 1000): GoldBookLevel[] {
  const out: GoldBookLevel[] = [];
  for (const [pxRaw, szRaw] of rows.slice(0, n)) {
    const px = Number(pxRaw);
    const sz = Number(szRaw);
    if (!Number.isFinite(px) || !Number.isFinite(sz) || px <= 0 || sz <= 0) continue;
    out.push({ px, sz, usd: px * sz });
  }
  return out;
}

function walls(bids: GoldBookLevel[], asks: GoldBookLevel[], mid: number) {
  let bidWall = bids[0] ?? null;
  let askWall = asks[0] ?? null;
  for (const lvl of bids) if (!bidWall || lvl.usd > bidWall.usd) bidWall = lvl;
  for (const lvl of asks) if (!askWall || lvl.usd > askWall.usd) askWall = lvl;
  let depthBid = 0;
  let depthAsk = 0;
  for (const lvl of bids) {
    if (mid > 0 && (mid - lvl.px) / mid <= 0.001) depthBid += lvl.usd;
  }
  for (const lvl of asks) {
    if (mid > 0 && (lvl.px - mid) / mid <= 0.001) depthAsk += lvl.usd;
  }
  return {
    bid_wall_px: bidWall?.px ?? null,
    bid_wall_usd: bidWall?.usd ?? null,
    ask_wall_px: askWall?.px ?? null,
    ask_wall_usd: askWall?.usd ?? null,
    depth_10bp_bid_usd: depthBid,
    depth_10bp_ask_usd: depthAsk,
  };
}

async function fetchBinanceDepth(symbol: GoldDepthSymbol): Promise<GoldBookDepth | null> {
  const hosts = [
    `https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=1000`,
    `https://data-api.binance.vision/api/v3/depth?symbol=${symbol}&limit=1000`,
    `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=1000`,
    `https://api1.binance.com/api/v3/depth?symbol=${symbol}&limit=1000`,
  ];
  try {
    return await Promise.any(
      hosts.map(async (url) => {
        const res = await bookFetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as { bids?: Array<[string, string]>; asks?: Array<[string, string]> };
        const bids = toLevels(d.bids ?? []);
        const asks = toLevels(d.asks ?? []);
        if (!bids.length || !asks.length) throw new Error("empty");
        const mid = (bids[0].px + asks[0].px) / 2;
        return {
          symbol,
          mid,
          bids,
          asks,
          ...walls(bids, asks, mid),
          source: url.includes("fapi") ? `Binance futures ${symbol}` : `Binance ${symbol}`,
          as_of: new Date().toISOString(),
        };
      }),
    );
  } catch {
    return null;
  }
}

async function fetchBybitDepth(symbol: GoldDepthSymbol): Promise<GoldBookDepth | null> {
  const hosts = [
    `https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${symbol}&limit=200`,
    `https://api.bytick.com/v5/market/orderbook?category=linear&symbol=${symbol}&limit=200`,
    `https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${symbol}&limit=200`,
  ];
  try {
    return await Promise.any(
      hosts.map(async (url) => {
        const res = await bookFetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as {
          result?: { b?: Array<[string, string]>; a?: Array<[string, string]> };
        };
        const bids = toLevels(d.result?.b ?? []);
        const asks = toLevels(d.result?.a ?? []);
        if (!bids.length || !asks.length) throw new Error("empty");
        const mid = (bids[0].px + asks[0].px) / 2;
        return {
          symbol,
          mid,
          bids,
          asks,
          ...walls(bids, asks, mid),
          source: `Bybit ${symbol}`,
          as_of: new Date().toISOString(),
        };
      }),
    );
  } catch {
    return null;
  }
}

async function fetchOkxDepth(symbol: GoldDepthSymbol): Promise<GoldBookDepth | null> {
  const instId = symbol === "XAGUSDT" ? "XAG-USDT" : "XAU-USDT";
  try {
    const ids = [instId, `${instId}-SWAP`];
    for (const id of ids) {
      try {
        const res = await bookFetch(`https://www.okx.com/api/v5/market/books?instId=${id}&sz=400`);
        if (!res.ok) continue;
        const d = (await res.json()) as {
          data?: Array<{ bids?: Array<[string, string, ...unknown[]]>; asks?: Array<[string, string, ...unknown[]]> }>;
        };
        const row = d.data?.[0];
        const bids = toLevels((row?.bids ?? []).map((x) => [x[0], x[1]]));
        const asks = toLevels((row?.asks ?? []).map((x) => [x[0], x[1]]));
        if (!bids.length || !asks.length) continue;
        const mid = (bids[0].px + asks[0].px) / 2;
        return {
          symbol,
          mid,
          bids,
          asks,
          ...walls(bids, asks, mid),
          source: `OKX ${id}`,
          as_of: new Date().toISOString(),
        };
      } catch {
        /* next inst */
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchGoldBookDepth(symbol: GoldDepthSymbol): Promise<GoldBookDepth | null> {
  const now = Date.now();
  const hit = cache.get(symbol);
  if (hit && now - hit.at < TTL_MS) return hit.book;
  const pending = inflight.get(symbol);
  if (pending) return pending;
  const job = (async () => {
    try {
      const book = await Promise.any(
        [fetchBinanceDepth(symbol), fetchOkxDepth(symbol), fetchBybitDepth(symbol)].map(async (p) => {
          const hit = await p;
          if (!hit) throw new Error("empty");
          return hit;
        }),
      ).catch(() => null);
      if (book) cache.set(symbol, { book, at: Date.now() });
      return book ?? cache.get(symbol)?.book ?? null;
    } finally {
      inflight.delete(symbol);
    }
  })();
  inflight.set(symbol, job);
  return job;
}
