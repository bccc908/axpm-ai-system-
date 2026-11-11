/** Sober trading-desk palette (broker platform style) */
export const VIZ = {
  bg: "#11161e",
  buy: "#26a69a",
  buyDim: "#1e877d",
  sell: "#ef5350",
  sellDim: "#c94442",
  cyan: "#5b9cf0",
  cyanBright: "#8ab8f5",
  gold: "#d9a03f",
  goldBright: "#e8bd6a",
  purple: "#9a84e8",
  orange: "#e08a3c",
} as const;

/** Target ~70% of heatmap cells in warm/red band */
export const HEAT_WARM_FRACTION = 0.7;

export function boostHeatIntensity(t: number) {
  const v = Math.min(1, Math.max(0, t));
  const warmFloor = 1 - HEAT_WARM_FRACTION;
  return Math.min(1, warmFloor * 0.55 + Math.pow(v, 0.42) * (1 - warmFloor * 0.55));
}

/** COLD (≤30%) maroon/navy → HOT vivid red/orange */
export function heatRgb(t: number): [number, number, number] {
  const v = boostHeatIntensity(t);
  if (v < 0.12) {
    const s = v / 0.12;
    return [Math.round(18 + s * 45), Math.round(10 + s * 22), Math.round(72 + s * 55)];
  }
  if (v < 0.28) {
    const s = (v - 0.12) / 0.16;
    return [Math.round(63 + s * 95), Math.round(32 + s * 38), Math.round(127 - s * 85)];
  }
  if (v < 0.48) {
    const s = (v - 0.28) / 0.2;
    return [Math.round(158 + s * 97), Math.round(70 + s * 95), Math.round(42 - s * 28)];
  }
  if (v < 0.68) {
    const s = (v - 0.48) / 0.2;
    return [255, Math.round(165 - s * 95), Math.round(14 + s * 22)];
  }
  const s = (v - 0.68) / 0.32;
  return [255, Math.round(70 - s * 55), Math.round(36 - s * 18)];
}

export function heatAlpha(intensity: number) {
  return 0.42 + boostHeatIntensity(intensity) * 0.68;
}

/** Final cell warmth — enforces ~70% red/orange coverage */
export function mapCellHeatIntensity(raw: number) {
  const v = Math.min(1, Math.max(0, raw));
  const coldCap = 1 - HEAT_WARM_FRACTION;
  return Math.min(1, coldCap * 0.5 + v * (1 - coldCap * 0.35));
}
