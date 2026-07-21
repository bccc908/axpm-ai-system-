import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";

export type OrderSide = "buy" | "sell";

/** One bar — buy/sell split from close location in range (no tick feed). */
export interface BarFlowRow {
  id: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVol: number;
  sellVol: number;
  delta: number;
  side: OrderSide;
}

/** @deprecated Use BarFlowRow — kept for imports */
export type OrderFlowPrint = BarFlowRow;

export interface PriceLevelFlow {
  price: number;
  buyVol: number;
  sellVol: number;
  barCount: number;
  lastSide: OrderSide;
  inEntryZone: boolean;
}

function roundTick(price: number, tick: number) {
  return Math.round(price / tick) * tick;
}

/** Buy ≈ vol × (close−low)/(high−low); standard OHLC delta proxy. */
export function barBuySellVolume(bar: GoldOhlcBar): { buyVol: number; sellVol: number } {
  const vol = bar.volume > 0 ? bar.volume : 0;
  const range = bar.high - bar.low;
  if (vol <= 0 || range < 0.01) {
    const half = vol / 2;
    return { buyVol: half, sellVol: half };
  }
  const buyVol = vol * (bar.close - bar.low) / range;
  return { buyVol, sellVol: vol - buyVol };
}

export function buildBarFlowFromBars(bars: GoldOhlcBar[]): BarFlowRow[] {
  return bars
    .filter((b) => b.volume > 0)
    .map((bar) => {
      const { buyVol, sellVol } = barBuySellVolume(bar);
      const delta = buyVol - sellVol;
      return {
        id: `bf-${bar.time}`,
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        buyVol,
        sellVol,
        delta,
        side: (delta >= 0 ? "buy" : "sell") as OrderSide,
      };
    })
    .sort((a, b) => b.time - a.time);
}

export function buildOrderFlowFromBars(bars: GoldOhlcBar[]): BarFlowRow[] {
  return buildBarFlowFromBars(bars);
}

function barFootprintCells(bar: GoldOhlcBar, tick: number): Map<number, { buy: number; sell: number }> {
  const { buyVol, sellVol } = barBuySellVolume(bar);
  const range = bar.high - bar.low;

  if (range < tick * 0.25) {
    const p = roundTick(bar.close, tick);
    return new Map([[p, { buy: buyVol, sell: sellVol }]]);
  }

  const levels: number[] = [];
  for (let p = roundTick(bar.low, tick); p <= bar.high + tick * 0.01; p += tick) {
    levels.push(Math.round(p * 100) / 100);
  }

  const buyLevels = levels.filter((p) => p <= bar.close + tick * 0.25);
  const sellLevels = levels.filter((p) => p > bar.close + tick * 0.25);

  const buyWeight = (p: number) => Math.max(tick * 0.1, bar.close - p + tick);
  const sellWeight = (p: number) => Math.max(tick * 0.1, p - bar.close + tick);

  const sumBuyW = buyLevels.reduce((s, p) => s + buyWeight(p), 0) || 1;
  const sumSellW = sellLevels.reduce((s, p) => s + sellWeight(p), 0) || 1;

  const cells = new Map<number, { buy: number; sell: number }>();

  for (const p of buyLevels) {
    const cur = cells.get(p) ?? { buy: 0, sell: 0 };
    cur.buy += buyVol * (buyWeight(p) / sumBuyW);
    cells.set(p, cur);
  }
  for (const p of sellLevels) {
    const cur = cells.get(p) ?? { buy: 0, sell: 0 };
    cur.sell += sellVol * (sellWeight(p) / sumSellW);
    cells.set(p, cur);
  }

  return cells;
}

export function aggregateFlowByPrice(
  bars: GoldOhlcBar[],
  entryLo: number | null,
  entryHi: number | null,
  tick = 0.5,
): PriceLevelFlow[] {
  const map = new Map<number, PriceLevelFlow>();

  for (const bar of bars) {
    if (bar.volume <= 0) continue;
    for (const [price, vol] of barFootprintCells(bar, tick)) {
      const row = map.get(price) ?? {
        price,
        buyVol: 0,
        sellVol: 0,
        barCount: 0,
        lastSide: "buy" as OrderSide,
        inEntryZone: entryLo != null && entryHi != null && price >= entryLo && price <= entryHi,
      };
      row.buyVol += vol.buy;
      row.sellVol += vol.sell;
      row.barCount += 1;
      row.lastSide = vol.buy >= vol.sell ? "buy" : "sell";
      map.set(price, row);
    }
  }

  return [...map.values()].sort((a, b) => b.price - a.price);
}

export function footprintGrid(
  bars: GoldOhlcBar[],
  cols = 28,
  priceBounds?: { priceMin: number; priceMax: number },
): {
  colTimes: number[];
  priceMin: number;
  priceMax: number;
  cells: Map<string, { buy: number; sell: number }>;
} {
  const slice = bars.filter((b) => b.volume > 0).slice(-cols);
  const colTimes = slice.map((b) => b.time);

  if (slice.length === 0) {
    return { colTimes: [], priceMin: 0, priceMax: 0, cells: new Map() };
  }

  let priceMin: number;
  let priceMax: number;
  if (priceBounds) {
    priceMin = priceBounds.priceMin;
    priceMax = priceBounds.priceMax;
  } else {
    const allPrices = slice.flatMap((b) => [b.high, b.low]);
    priceMin = Math.min(...allPrices) - 2;
    priceMax = Math.max(...allPrices) + 2;
  }

  const tick = 0.5;
  const cells = new Map<string, { buy: number; sell: number }>();

  for (let col = 0; col < slice.length; col++) {
    for (const [row, vol] of barFootprintCells(slice[col], tick)) {
      cells.set(`${col}:${row}`, { buy: vol.buy, sell: vol.sell });
    }
  }

  return { colTimes, priceMin, priceMax, cells };
}

/** Stable Y-axis for footprint — only expands on new bar poll, not live ticks. */
export function footprintStableRange(
  bars: GoldOhlcBar[],
  opts?: {
    entryLo?: number | null;
    entryHi?: number | null;
    stop?: number | null;
    targets?: number[];
    padRatio?: number;
  },
) {
  const slice = bars.filter((b) => b.volume > 0);
  if (slice.length === 0) return { priceMin: 0, priceMax: 0 };

  const lows = slice.flatMap((b) => [b.low]);
  const highs = slice.flatMap((b) => [b.high]);
  const extras = [
    opts?.entryLo,
    opts?.entryHi,
    opts?.stop,
    ...(opts?.targets ?? []),
  ].filter((n): n is number => n != null && Number.isFinite(n));

  const min = Math.min(...lows, ...extras);
  const max = Math.max(...highs, ...extras);
  const pad = Math.max(3, (max - min) * (opts?.padRatio ?? 0.1));
  return { priceMin: min - pad, priceMax: max + pad };
}

export function cumulativeDelta(rows: BarFlowRow[]): number {
  return rows.reduce((s, r) => s + r.delta, 0);
}
