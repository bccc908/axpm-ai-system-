import { describe, expect, it } from "vitest";
import { computeDeterministicChecks, computeMarketContext } from "@/lib/gold-signals/risk-review/checks";
import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";

const base = {
  id: "t",
  spot_price: 4200,
  timeframe: "M15",
  entry_zone: { low: 4199, high: 4201 },
  stop_loss: 4194,
  take_profit: [4212, 4224],
};

describe("computeDeterministicChecks", () => {
  it("computes R:R and breakeven win rate in code", () => {
    const c = computeDeterministicChecks({ ...base, bias: "long" }, null);
    expect(c.entry).toBe(4200);
    expect(c.risk_pts).toBe(6);
    expect(c.primary_r).toBe(2);
    expect(c.breakeven_win_rate).toBeCloseTo(1 / 3, 4);
    expect(c.targets[1].r).toBe(4);
    expect(c.rr_below_min).toBe(false);
  });

  it("flags R:R below 1.5", () => {
    const c = computeDeterministicChecks({ ...base, bias: "long", take_profit: [4206] }, null);
    expect(c.primary_r).toBe(1);
    expect(c.rr_below_min).toBe(true);
    expect(c.flags.some((f) => f.code === "rr_below_min" && f.severity === "critical")).toBe(true);
  });

  it("flags levels on the wrong side for the bias", () => {
    const c = computeDeterministicChecks({ ...base, bias: "short" }, null);
    expect(c.flags.some((f) => f.code === "invalid_geometry")).toBe(true);
  });

  it("flags non-directional bias and missing levels", () => {
    const c = computeDeterministicChecks({ ...base, bias: "wait", stop_loss: null }, null);
    const codes = c.flags.map((f) => f.code);
    expect(codes).toContain("no_directional_bias");
    expect(codes).toContain("missing_levels");
    expect(c.primary_r).toBeNull();
  });

  it("marks round-number liquidity next to the stop as stop-hunt risk", () => {
    const c = computeDeterministicChecks({ ...base, bias: "long", stop_loss: 4191 }, null);
    const z = c.liquidity_zones.find((l) => l.price === 4190);
    expect(z?.stop_hunt_risk).toBe(true);
    expect(c.flags.some((f) => f.code === "stop_near_liquidity")).toBe(true);
  });
});

describe("computeMarketContext", () => {
  it("computes ATR, VWAP and value area from bars, and stop/ATR multiple", () => {
    const bars: GoldOhlcBar[] = Array.from({ length: 60 }, (_, i) => ({
      time: 1_700_000_000 + i * 900,
      open: 4200 + Math.sin(i / 5) * 3,
      high: 4202 + Math.sin(i / 5) * 3,
      low: 4198 + Math.sin(i / 5) * 3,
      close: 4200.5 + Math.sin(i / 5) * 3,
      volume: 100 + i,
    }));
    const ctx = computeMarketContext(bars, { interval: "15m", source: "test" });
    expect(ctx).not.toBeNull();
    expect(ctx!.atr14).toBeGreaterThan(3);
    expect(ctx!.vwap).toBeGreaterThan(4195);
    expect(ctx!.val!).toBeLessThanOrEqual(ctx!.vah!);
    const c = computeDeterministicChecks({ ...base, bias: "long" }, ctx);
    expect(c.stop_atr_multiple).toBeCloseTo(6 / ctx!.atr14!, 1);
  });

  it("returns null for too few bars", () => {
    expect(computeMarketContext([], { interval: "15m" })).toBeNull();
  });
});
