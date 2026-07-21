/**
 * Shared profit / R:R policy for gold, BTC, ETH signal engines.
 * Tunable via env:
 *   SIGNAL_MIN_RR_TP1=2
 *   SIGNAL_MIN_RR_TP2=3
 */
export function getMinRrTargets(): [number, number] {
  const tp1 = Number(process.env.SIGNAL_MIN_RR_TP1 ?? "2");
  const tp2 = Number(process.env.SIGNAL_MIN_RR_TP2 ?? "3");
  return [
    Number.isFinite(tp1) && tp1 > 0 ? tp1 : 2,
    Number.isFinite(tp2) && tp2 > 0 ? tp2 : 3,
  ];
}

export function profitPolicyPromptLines(locale: "en" | "zh"): string {
  const [r1, r2] = getMinRrTargets();
  if (locale === "zh") {
    return `- 盈亏比硬性要求：TP1 至少 ${r1}R，TP2 至少 ${r2}R（以进场中位到止损的距离为 1R）
- 若达不到上述盈亏比或结构不清晰，优先输出 bias=wait，不要硬给低盈亏比交易
- 进场区尽量窄；止损放在结构外；目标放在流动性/关键位，而不是随意取整数`;
  }
  return `- Hard R:R rule: TP1 >= ${r1}R, TP2 >= ${r2}R (1R = |entry mid − stop|)
- If that R:R is not realistic or structure is unclear, prefer bias=wait
- Keep entry zone tight; stop beyond structure; targets at liquidity/key levels`;
}

type Bias = "long" | "short" | "neutral" | "wait";

type Levels = {
  bias: Bias;
  entry_zone: { low: number; high: number } | null;
  stop_loss: number | null;
  take_profit: number[];
};

function roundPrice(n: number, tick = 0.01) {
  const p = Math.max(tick, Math.abs(n) >= 1000 ? 1 : tick);
  return Math.round(n / p) * p;
}

/**
 * Ensure take-profit levels meet minimum R multiples when a directional setup exists.
 * Does not invent entry/stop — only stretches targets (or leaves wait/neutral alone).
 */
export function enforceMinRiskReward(levels: Levels): Levels & { adjusted: boolean } {
  const { bias, entry_zone, stop_loss } = levels;
  if (bias !== "long" && bias !== "short") {
    return { ...levels, adjusted: false };
  }
  if (!entry_zone || stop_loss == null) {
    return { ...levels, adjusted: false };
  }

  const entry = (entry_zone.low + entry_zone.high) / 2;
  const risk = Math.abs(entry - stop_loss);
  if (risk < 0.01) return { ...levels, adjusted: false };

  // Stop must be on the correct side of entry
  if (bias === "long" && stop_loss >= entry) return { ...levels, adjusted: false };
  if (bias === "short" && stop_loss <= entry) return { ...levels, adjusted: false };

  const [r1, r2] = getMinRrTargets();
  const dir = bias === "long" ? 1 : -1;
  const minTp1 = entry + dir * risk * r1;
  const minTp2 = entry + dir * risk * r2;

  const existing = levels.take_profit.filter((n) => Number.isFinite(n));
  const tick = entry >= 1000 ? 1 : 0.01;

  const rewardR = (tp: number) => Math.abs(tp - entry) / risk;

  let tp1 = existing[0];
  let tp2 = existing[1];

  if (tp1 == null || rewardR(tp1) < r1 - 0.05 || Math.sign(tp1 - entry) !== dir) {
    tp1 = roundPrice(minTp1, tick);
  }
  if (tp2 == null || rewardR(tp2) < r2 - 0.05 || Math.sign(tp2 - entry) !== dir) {
    tp2 = roundPrice(minTp2, tick);
  }

  // Keep farther targets if AI already provided better ones
  if (existing.length > 2) {
    const extras = existing.slice(2).filter((tp) => Math.sign(tp - entry) === dir && rewardR(tp) >= r2);
    const take_profit = [tp1, tp2, ...extras].map((n) => roundPrice(n, tick));
    const adjusted =
      take_profit.length !== levels.take_profit.length ||
      take_profit.some((v, i) => v !== levels.take_profit[i]);
    return { ...levels, take_profit, adjusted };
  }

  const take_profit = [tp1, tp2].map((n) => roundPrice(n, tick));
  const adjusted =
    take_profit.length !== levels.take_profit.length ||
    take_profit.some((v, i) => v !== levels.take_profit[i]);
  return { ...levels, take_profit, adjusted };
}
