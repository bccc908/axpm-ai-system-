import "server-only";

import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { hlInfo } from "@/lib/hyperliquid/client";
import { fetchHlAccount } from "@/lib/hyperliquid/account";
import { getHyperliquidAddress } from "@/lib/hyperliquid/settings";
import { bracketPrices, gateBtcTrade } from "@/lib/groktagon/trade-gate";

export type KettCoin = "BTC" | "ETH";

export const KETT_MAX_USD = 12;
export const KETT_MAX_BTC = 0.00015;
export const KETT_MAX_ETH = 0.005;

function maxSz(coin: KettCoin) {
  return coin === "ETH" ? KETT_MAX_ETH : KETT_MAX_BTC;
}

function agentKey(): `0x${string}` | null {
  const raw = process.env.HYPERLIQUID_AGENT_PRIVATE_KEY?.trim() ?? "";
  if (!raw) return null;
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(hex)) return null;
  return hex as `0x${string}`;
}

export function kettArmed(): boolean {
  return agentKey() != null;
}

export function kettAgentAddress(): string | null {
  const key = agentKey();
  if (!key) return null;
  try {
    return privateKeyToAccount(key).address;
  } catch {
    return null;
  }
}

async function perpAsset(coin: KettCoin): Promise<{ id: number; szDecimals: number; mark: number }> {
  const [meta, mids] = await Promise.all([
    hlInfo<{ universe?: Array<{ name?: string; szDecimals?: number }> }>({ type: "meta" }),
    hlInfo<Record<string, string>>({ type: "allMids" }),
  ]);
  const universe = meta.universe ?? [];
  const id = universe.findIndex((c) => c.name === coin);
  if (id < 0) throw new Error(`${coin} asset missing`);
  const mark = Number(mids[coin]);
  if (!Number.isFinite(mark) || mark <= 0) throw new Error(`${coin} mark missing`);
  return { id, szDecimals: universe[id]?.szDecimals ?? (coin === "ETH" ? 4 : 5), mark };
}

function formatPx(px: number, coin: KettCoin) {
  if (coin === "BTC") return String(Math.round(px));
  return (Math.round(px * 10) / 10).toFixed(1);
}

function slipPx(mark: number, buy: boolean, coin: KettCoin) {
  return formatPx(buy ? mark * 1.01 : mark * 0.99, coin);
}

function sizeStr(sz: number, decimals: number, cap: number) {
  const minSz = 10 ** -Math.min(5, decimals);
  return Math.min(cap, Math.max(minSz, sz)).toFixed(Math.min(5, decimals));
}

function client() {
  const key = agentKey();
  if (!key) throw new Error("HYPERLIQUID_AGENT_PRIVATE_KEY missing");
  const transport = new HttpTransport();
  return new ExchangeClient({ transport, wallet: privateKeyToAccount(key) });
}

export async function kettClose(
  coin: KettCoin,
): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  const address = await getHyperliquidAddress();
  if (!address) return { ok: false, error: "master wallet not linked" };
  const account = await fetchHlAccount(address);
  const pos = account.positions.find((p) => p.coin === coin);
  if (!pos) return { ok: false, error: `no ${coin} position` };
  const { id, szDecimals, mark } = await perpAsset(coin);
  const buy = pos.side === "short";
  const sz = sizeStr(Math.abs(pos.size), szDecimals, maxSz(coin));
  const exchange = client();
  await exchange.order({
    orders: [
      {
        a: id,
        b: buy,
        p: slipPx(mark, buy, coin),
        s: sz,
        r: true,
        t: { limit: { tif: "Ioc" } },
      },
    ],
    grouping: "na",
  });
  return { ok: true, detail: `closed ${coin} ${pos.side} ${sz}` };
}

export const kettCloseBtc = () => kettClose("BTC");
export const kettCloseEth = () => kettClose("ETH");

export type KettOpenLevels = {
  source?: string;
  confidence?: number;
  created_at?: string;
  expires_at?: string | null;
  entry_low?: number | null;
  entry_high?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
};

export async function kettOpen(
  coin: KettCoin,
  side: "long" | "short",
  levels?: KettOpenLevels,
): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  if (!levels) return { ok: false, error: "no live setup · refuse chase" };
  const address = await getHyperliquidAddress();
  if (!address) return { ok: false, error: "master wallet not linked" };
  const account = await fetchHlAccount(address);
  if (account.positions.length) {
    const open = account.positions.map((p) => p.coin).join(",");
    return { ok: false, error: `${open} already open · close first` };
  }
  const { id, szDecimals, mark } = await perpAsset(coin);
  const gated = gateBtcTrade(
    {
      source: levels.source ?? (coin === "ETH" ? "eth" : "hl"),
      bias: side,
      confidence: levels.confidence ?? 0,
      created_at: levels.created_at ?? new Date(0).toISOString(),
      expires_at: levels.expires_at ?? null,
      entry_low: levels.entry_low ?? null,
      entry_high: levels.entry_high ?? null,
      stop_loss: levels.stop_loss ?? null,
    },
    mark,
  );
  if (!gated.ok) return { ok: false, error: gated.reason };
  const buy = side === "long";
  const cap = Math.min(maxSz(coin), KETT_MAX_USD / mark);
  const sz = sizeStr(cap, szDecimals, maxSz(coin));
  const raw = bracketPrices(mark, side, levels.stop_loss ?? null, levels.take_profit ?? null);
  const sl = formatPx(Number(raw.sl), coin);
  const tp = formatPx(Number(raw.tp), coin);
  const exchange = client();
  await exchange.order({
    orders: [
      {
        a: id,
        b: buy,
        p: slipPx(mark, buy, coin),
        s: sz,
        r: false,
        t: { limit: { tif: "Ioc" } },
      },
      {
        a: id,
        b: !buy,
        p: slipPx(Number(tp), !buy, coin),
        s: sz,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: tp, tpsl: "tp" } },
      },
      {
        a: id,
        b: !buy,
        p: slipPx(Number(sl), !buy, coin),
        s: sz,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: sl, tpsl: "sl" } },
      },
    ],
    grouping: "normalTpsl",
  });
  return { ok: true, detail: `opened ${coin} ${side} ${sz} sl ${sl} tp ${tp}` };
}

export function kettOpenBtc(side: "long" | "short", levels?: KettOpenLevels) {
  return kettOpen("BTC", side, levels);
}

export function kettOpenEth(side: "long" | "short", levels?: KettOpenLevels) {
  return kettOpen("ETH", side, levels);
}
