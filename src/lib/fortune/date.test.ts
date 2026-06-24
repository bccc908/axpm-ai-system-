import { describe, expect, it } from "vitest";
import { getFortuneTodayKey } from "@/lib/fortune/date";

describe("getFortuneTodayKey", () => {
  it("uses Hong Kong timezone for date key", () => {
    // 2026-06-16 23:30 HKT = still June 16
    const hkLate = new Date("2026-06-16T15:30:00.000Z");
    expect(getFortuneTodayKey(hkLate)).toBe("2026-06-16");

    // 2026-06-16 16:30 UTC = June 17 00:30 HKT
    const hkMidnight = new Date("2026-06-16T16:30:00.000Z");
    expect(getFortuneTodayKey(hkMidnight)).toBe("2026-06-17");
  });
});
