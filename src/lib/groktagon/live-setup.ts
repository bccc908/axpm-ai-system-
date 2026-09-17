import "server-only";

import { listBtcSignals } from "@/lib/btc-signals/store";
import { listHlSignals } from "@/lib/hl-signals/store";
import { fetchHlSpotQuote } from "@/lib/hyperliquid/price";
import { gateBtcTrade, type GateInput } from "@/lib/groktagon/trade-gate";

function asGate(
  source: "btc" | "hl",
  row: {
    bias: string;
    confidence: number;
    created_at: string;
    expires_at?: string | null;
    entry_zone?: { low: number; high: number } | null;
    stop_loss?: number | null;
    take_profit?: number[];
  },
): GateInput & { take_profit: number | null } {
  return {
    source,
    bias: row.bias,
    confidence: row.confidence,
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
    entry_low: row.entry_zone?.low ?? null,
    entry_high: row.entry_zone?.high ?? null,
    stop_loss: row.stop_loss ?? null,
    take_profit: row.take_profit?.[0] ?? null,
  };
}

export type LiveBtcSetup =
  | {
      ok: true;
      side: "long" | "short";
      mark: number;
      confidence: number;
      source: "btc" | "hl";
      created_at: string;
      expires_at: string | null;
      entry_low: number | null;
      entry_high: number | null;
      stop_loss: number | null;
      take_profit: number | null;
      reason: string;
    }
  | { ok: false; mark: number | null; reason: string };

export async function resolveLiveBtcSetup(): Promise<LiveBtcSetup> {
  const [quote, hl, btc] = await Promise.all([
    fetchHlSpotQuote().catch(() => null),
    listHlSignals(6).catch(() => []),
    listBtcSignals(6).catch(() => []),
  ]);
  const mark = quote?.price ?? null;
  const rows = [
    ...hl.map((s) => asGate("hl", s)),
    ...btc.map((s) => asGate("btc", s)),
  ];
  if (mark == null) return { ok: false, mark: null, reason: "no live BTC mark" };
  for (const row of rows) {
    const g = gateBtcTrade(row, mark);
    if (g.ok && (row.bias === "long" || row.bias === "short")) {
      return {
        ok: true,
        side: row.bias,
        mark,
        confidence: row.confidence,
        source: row.source === "btc" ? "btc" : "hl",
        created_at: row.created_at,
        expires_at: row.expires_at ?? null,
        entry_low: row.entry_low,
        entry_high: row.entry_high,
        stop_loss: row.stop_loss,
        take_profit: row.take_profit,
        reason: `live ${row.source} ${row.bias} ${row.confidence}%`,
      };
    }
  }
  const first = rows[0];
  if (!first) return { ok: false, mark, reason: "no BTC/HL signal on book" };
  const firstGate = gateBtcTrade(first, mark);
  return { ok: false, mark, reason: firstGate.ok ? "no live zone" : firstGate.reason };
}
