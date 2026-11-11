import { describe, expect, it } from "vitest";
import { buildLadderItems } from "./ladder-display";
import type { PriceLevelFlow } from "./order-flow";

const lvl = (price: number, buyVol: number, sellVol: number): PriceLevelFlow => ({
  price, buyVol, sellVol, barCount: 1, lastSide: "buy", inEntryZone: false,
});

describe("buildLadderItems", () => {
  const levels = [lvl(4014, 10, 5), lvl(4012, 0.2, 0.1), lvl(4011.5, 3, 4)];

  it("shows every tick when hide-empty is off", () => {
    const items = buildLadderItems(levels, false, null, null);
    expect(items.map((i) => (i.kind === "row" ? i.row.price : "gap"))).toEqual([4014, 4013.5, 4013, 4012.5, 4012, 4011.5]);
    expect(items.filter((i) => i.kind === "row" && i.empty)).toHaveLength(4);
  });

  it("collapses empty runs into one divider with the skipped range", () => {
    const items = buildLadderItems(levels, true, null, null);
    expect(items).toHaveLength(3);
    expect(items[1]).toEqual({ kind: "gap", from: 4013.5, to: 4012, count: 4 });
  });

  it("returns nothing for no data", () => {
    expect(buildLadderItems([], true, null, null)).toEqual([]);
  });
});
