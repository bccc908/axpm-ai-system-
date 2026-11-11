import type { PriceLevelFlow } from "@/lib/gold-signals/order-flow";

/** Display-only helpers for the order-flow "by price" ladder. No data/aggregation logic lives here. */

const LADDER_TICK = 0.5;
const MAX_LADDER_ROWS = 2000;

export type LadderItem =
  | { kind: "row"; row: PriceLevelFlow; empty: boolean }
  | { kind: "gap"; from: number; to: number; count: number };

/** A row is "empty" when nothing would display: rounded buy and sell volume are both 0. */
export function isEmptyLevel(row: PriceLevelFlow) {
  return Math.round(row.buyVol) === 0 && Math.round(row.sellVol) === 0;
}

/** Presentation only: lay the aggregated levels on a contiguous tick grid, then optionally collapse empty runs. */
export function buildLadderItems(levels: PriceLevelFlow[], hideEmpty: boolean, entryLo: number | null, entryHi: number | null): LadderItem[] {
  if (levels.length === 0) return [];
  const byKey = new Map(levels.map((l) => [Math.round(l.price / LADDER_TICK), l]));
  const hiKey = Math.max(...byKey.keys());
  const loKey = Math.min(...byKey.keys());
  const full: { row: PriceLevelFlow; empty: boolean }[] = [];
  if (hiKey - loKey > MAX_LADDER_ROWS) {
    for (const l of levels) full.push({ row: l, empty: isEmptyLevel(l) });
  } else {
    for (let k = hiKey; k >= loKey; k--) {
      const found = byKey.get(k);
      const price = Math.round(k * LADDER_TICK * 100) / 100;
      const row: PriceLevelFlow = found ?? {
        price,
        buyVol: 0,
        sellVol: 0,
        barCount: 0,
        lastSide: "buy",
        inEntryZone: entryLo != null && entryHi != null && price >= entryLo && price <= entryHi,
      };
      full.push({ row, empty: isEmptyLevel(row) });
    }
  }
  if (!hideEmpty) return full.map((f) => ({ kind: "row", ...f }));

  const out: LadderItem[] = [];
  let run: PriceLevelFlow[] = [];
  const flush = () => {
    if (run.length === 0) return;
    out.push({ kind: "gap", from: run[0].price, to: run[run.length - 1].price, count: run.length });
    run = [];
  };
  for (const f of full) {
    if (f.empty) {
      run.push(f.row);
      continue;
    }
    flush();
    out.push({ kind: "row", row: f.row, empty: false });
  }
  flush();
  // Drop leading/trailing gaps — nothing to separate there.
  while (out[0]?.kind === "gap") out.shift();
  while (out.at(-1)?.kind === "gap") out.pop();
  return out;
}
