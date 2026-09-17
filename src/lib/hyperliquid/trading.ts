import "server-only";

import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { hlInfo } from "@/lib/hyperliquid/client";
import { fetchHlAccount } from "@/lib/hyperliquid/account";
import { getHyperliquidAddress } from "@/lib/hyperliquid/settings";
import { bracketPrices, gateBtcTrade } from "@/lib/groktagon/trade-gate";

export const KETT_MAX_BTC = 0.00015;

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

async function btcAsset(): Promise<{ id: number; szDecimals: number; mark: number }> {
  const [meta, mids] = await Promise.all([
    hlInfo<{ universe?: Array<{ name?: string; szDecimals?: number }> }>({ type: "meta" }),
    hlInfo<Record<string, string>>({ type: "allMids" }),
  ]);
  const universe = meta.universe ?? [];
  const id = universe.findIndex((c) => c.name === "BTC");
  if (id < 0) throw new Error("BTC asset missing");
  const mark = Number(mids.BTC);
  if (!Number.isFinite(mark) || mark <= 0) throw new Error("BTC mark missing");
  return { id, szDecimals: universe[id]?.szDecimals ?? 5, mark };
}

function slipPx(mark: number, buy: boolean) {
  const px = buy ? mark * 1.01 : mark * 0.99;
  return String(Math.round(px));
}

function sizeStr(sz: number, decimals: number) {
  return Math.min(KETT_MAX_BTC, Math.max(0.00001, sz)).toFixed(Math.min(5, decimals));
}

function client() {
  const key = agentKey();
  if (!key) throw new Error("HYPERLIQUID_AGENT_PRIVATE_KEY missing");
  const transport = new HttpTransport();
  return new ExchangeClient({ transport, wallet: privateKeyToAccount(key) });
}

export async function kettCloseBtc(): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  const address = await getHyperliquidAddress();
  if (!address) return { ok: false, error: "master wallet not linked" };
  const account = await fetchHlAccount(address);
  const pos = account.positions.find((p) => p.coin === "BTC");
  if (!pos) return { ok: false, error: "no BTC position" };
  const { id, szDecimals, mark } = await btcAsset();
  const buy = pos.side === "short";
  const sz = sizeStr(Math.abs(pos.size), szDecimals);
  const exchange = client();
  await exchange.order({
    orders: [
      {
        a: id,
        b: buy,
        p: slipPx(mark, buy),
        s: sz,
        r: true,
        t: { limit: { tif: "Ioc" } },
      },
    ],
    grouping: "na",
  });
  return { ok: true, detail: `closed BTC ${pos.side} ${sz}` };
}

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

export async function kettOpenBtc(
  side: "long" | "short",
  levels?: KettOpenLevels,
): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  if (!levels) return { ok: false, error: "no live setup · refuse chase" };
  const address = await getHyperliquidAddress();
  if (!address) return { ok: false, error: "master wallet not linked" };
  const account = await fetchHlAccount(address);
  if (account.positions.some((p) => p.coin === "BTC")) {
    return { ok: false, error: "BTC already open · close first" };
  }
  const { id, szDecimals, mark } = await btcAsset();
  const gated = gateBtcTrade(
    {
      source: levels.source ?? "hl",
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
  const sz = sizeStr(KETT_MAX_BTC, szDecimals);
  const { sl, tp } = bracketPrices(mark, side, levels.stop_loss ?? null, levels.take_profit ?? null);
  const exchange = client();
  await exchange.order({
    orders: [
      {
        a: id,
        b: buy,
        p: slipPx(mark, buy),
        s: sz,
        r: false,
        t: { limit: { tif: "Ioc" } },
      },
      {
        a: id,
        b: !buy,
        p: slipPx(Number(tp), !buy),
        s: sz,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: tp, tpsl: "tp" } },
      },
      {
        a: id,
        b: !buy,
        p: slipPx(Number(sl), !buy),
        s: sz,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: sl, tpsl: "sl" } },
      },
    ],
    grouping: "normalTpsl",
  });
  return { ok: true, detail: `opened BTC ${side} ${sz} sl ${sl} tp ${tp}` };
}
