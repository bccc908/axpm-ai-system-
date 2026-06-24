import { getZiweiChart } from "@/lib/fortune/ziwei";

/** Reference chart: Kayden 1994-02-14 10:45 巳时 */
export function assertKaydenZiweiChart() {
  const chart = getZiweiChart(
    {
      name: "Kayden",
      birth_date: "1994-02-14",
      birth_time: "10:45",
      notes: "甲戌年丙寅月辛未日癸巳时",
    },
    "zh",
  );

  if (!chart) throw new Error("Ziwei chart returned null");

  const checks: Array<[string, boolean]> = [
    ["wuxingJu", chart.wuxingJu === "金四局"],
    ["mingGong", chart.mingGong === "癸酉"],
    ["mingStars", chart.mingStars.join("、") === "太阳、天梁"],
    ["shenGong", chart.shenGong === "未"],
    ["shenStars", chart.shenStars.join("、") === "天同、巨门"],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length > 0) {
    throw new Error(
      `Ziwei sanity failed: ${failed.map(([k]) => k).join(", ")} — got ${JSON.stringify(chart)}`,
    );
  }

  return chart;
}

assertKaydenZiweiChart();
console.log("Ziwei sanity OK:", assertKaydenZiweiChart().summary);
