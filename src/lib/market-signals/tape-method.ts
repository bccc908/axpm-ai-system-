/** Bar-level tape stats shared by the gold liquidity pack and Hyperliquid tape. */

export type BarTapeInput = {
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type BarTapeStats = {
  vwap: number | null;
  vwap_pct: number | null;
  poc: number | null;
  vah: number | null;
  val: number | null;
  range_low: number | null;
  range_high: number | null;
  range_pos: number | null;
  cvd: number | null;
  delta_30m: number | null;
  buy_share: number | null;
};

const EMPTY: BarTapeStats = {
  vwap: null,
  vwap_pct: null,
  poc: null,
  vah: null,
  val: null,
  range_low: null,
  range_high: null,
  range_pos: null,
  cvd: null,
  delta_30m: null,
  buy_share: null,
};

function round(n: number, digits = 2) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function split(row: BarTapeInput) {
  const span = row.high - row.low;
  if (!(row.volume > 0) || span < 0.01) {
    const half = Math.max(0, row.volume) / 2;
    return { buy: half, sell: half };
  }
  const buy = row.volume * ((row.close - row.low) / span);
  return { buy, sell: row.volume - buy };
}

/** OHLC volume profile. `tick` bins the POC. Recent delta uses the last 6 bars. */
export function computeBarTape(rows: BarTapeInput[], mark: number | null, tick: number): BarTapeStats {
  const clean = rows.filter(
    (row) =>
      Number.isFinite(row.close) &&
      Number.isFinite(row.high) &&
      Number.isFinite(row.low) &&
      Number.isFinite(row.volume) &&
      row.volume > 0 &&
      row.high >= row.low,
  );
  if (!clean.length) return EMPTY;

  const step = tick > 0 ? tick : 0.5;
  let pv = 0;
  let vol = 0;
  let buy = 0;
  let sell = 0;
  let rangeLow = Number.POSITIVE_INFINITY;
  let rangeHigh = Number.NEGATIVE_INFINITY;
  const profile = new Map<number, number>();

  for (const row of clean) {
    const typical = (row.high + row.low + row.close) / 3;
    pv += typical * row.volume;
    vol += row.volume;
    const side = split(row);
    buy += side.buy;
    sell += side.sell;
    const px = Math.round(row.close / step) * step;
    profile.set(px, (profile.get(px) ?? 0) + row.volume);
    rangeLow = Math.min(rangeLow, row.low);
    rangeHigh = Math.max(rangeHigh, row.high);
  }

  let poc: number | null = null;
  let pocVol = -1;
  for (const [px, size] of profile) {
    if (size > pocVol) {
      pocVol = size;
      poc = px;
    }
  }

  const ranked = [...profile.entries()].sort((a, b) => b[1] - a[1]);
  const target = vol * 0.7;
  let acc = 0;
  const valueArea: number[] = [];
  for (const [px, size] of ranked) {
    valueArea.push(px);
    acc += size;
    if (acc >= target) break;
  }

  let recentBuy = 0;
  let recentSell = 0;
  for (const row of clean.slice(-6)) {
    const side = split(row);
    recentBuy += side.buy;
    recentSell += side.sell;
  }

  const vwap = vol > 0 ? pv / vol : null;
  const ref = mark ?? clean[clean.length - 1]?.close ?? null;
  const span = rangeHigh - rangeLow;

  return {
    vwap: vwap != null ? round(vwap) : null,
    vwap_pct: vwap != null && ref != null && vwap !== 0 ? round(((ref - vwap) / vwap) * 100) : null,
    poc: poc != null ? round(poc) : null,
    vah: valueArea.length ? round(Math.max(...valueArea)) : null,
    val: valueArea.length ? round(Math.min(...valueArea)) : null,
    range_low: Number.isFinite(rangeLow) ? round(rangeLow) : null,
    range_high: Number.isFinite(rangeHigh) ? round(rangeHigh) : null,
    range_pos: ref != null && span > 0 ? Math.min(1, Math.max(0, (ref - rangeLow) / span)) : null,
    cvd: round(buy - sell, 0),
    delta_30m: round(recentBuy - recentSell, 0),
    buy_share: vol > 0 ? buy / vol : null,
  };
}

export function formatBarTape(coin: string, tape: BarTapeStats, extra: string[] = []) {
  const n = (value: number | null, digits = 2) => (value == null ? "—" : value.toFixed(digits));
  const share = tape.buy_share == null ? "—" : `${Math.round(tape.buy_share * 100)}%`;
  const head = `${coin} VWAP ${n(tape.vwap)} (${n(tape.vwap_pct)}%) · POC ${n(tape.poc)} · VA ${n(tape.val)}–${n(tape.vah)} · CVD ${n(tape.cvd, 0)} · Δ ${n(tape.delta_30m, 0)} · buy ${share}`;
  return [head, ...extra].join("\n");
}
