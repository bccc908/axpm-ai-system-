import "server-only";

import { hlInfo } from "@/lib/hyperliquid/client";

export type HlPosition = {
  coin: string;
  size: number;
  side: "long" | "short";
  entry_px: number | null;
  position_value: number | null;
  unrealized_pnl: number | null;
  leverage: number | null;
  liquidation_px: number | null;
  margin_used: number | null;
};

export type HlAccountSnapshot = {
  address: string;
  account_value: number | null;
  withdrawable: number | null;
  total_margin_used: number | null;
  total_ntl_pos: number | null;
  positions: HlPosition[];
  as_of: string;
};

type ClearinghouseState = {
  marginSummary?: {
    accountValue?: string;
    totalNtlPos?: string;
    totalMarginUsed?: string;
  };
  withdrawable?: string;
  assetPositions?: Array<{
    position?: {
      coin?: string;
      szi?: string;
      entryPx?: string;
      positionValue?: string;
      unrealizedPnl?: string;
      leverage?: { value?: number | string };
      liquidationPx?: string | null;
      marginUsed?: string;
    };
  }>;
};

function toNum(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchHlAccount(address: string): Promise<HlAccountSnapshot> {
  const state = await hlInfo<ClearinghouseState>({
    type: "clearinghouseState",
    user: address,
  });

  const positions: HlPosition[] = [];
  for (const row of state.assetPositions ?? []) {
    const p = row.position;
    const size = toNum(p?.szi) ?? 0;
    if (size === 0) continue;
    positions.push({
      coin: p?.coin ?? "—",
      size,
      side: size > 0 ? "long" : "short",
      entry_px: toNum(p?.entryPx),
      position_value: toNum(p?.positionValue),
      unrealized_pnl: toNum(p?.unrealizedPnl),
      leverage: toNum(p?.leverage?.value),
      liquidation_px: toNum(p?.liquidationPx),
      margin_used: toNum(p?.marginUsed),
    });
  }

  return {
    address,
    account_value: toNum(state.marginSummary?.accountValue),
    withdrawable: toNum(state.withdrawable),
    total_margin_used: toNum(state.marginSummary?.totalMarginUsed),
    total_ntl_pos: toNum(state.marginSummary?.totalNtlPos),
    positions,
    as_of: new Date().toISOString(),
  };
}
