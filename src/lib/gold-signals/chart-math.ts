export interface GoldOhlcBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type IndicatorPoint = { time: number; value: number };

export function computeEma(bars: GoldOhlcBar[], period: number): IndicatorPoint[] {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  const out: IndicatorPoint[] = [];
  let ema = bars.slice(0, period).reduce((s, b) => s + b.close, 0) / period;
  out.push({ time: bars[period - 1].time, value: round(ema) });
  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    out.push({ time: bars[i].time, value: round(ema) });
  }
  return out;
}

export function computeRsi(bars: GoldOhlcBar[], period = 14): IndicatorPoint[] {
  if (bars.length <= period) return [];

  const out: IndicatorPoint[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  const push = (i: number) => {
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    out.push({ time: bars[i].time, value: round(rsi) });
  };

  push(period);

  for (let i = period + 1; i < bars.length; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    push(i);
  }

  return out;
}

export function computeMacd(
  bars: GoldOhlcBar[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
) {
  const emaFast = computeEma(bars, fast);
  const emaSlow = computeEma(bars, slow);
  if (emaFast.length === 0 || emaSlow.length === 0) {
    return { macd: [] as IndicatorPoint[], signal: [] as IndicatorPoint[], histogram: [] as IndicatorPoint[] };
  }

  const slowMap = new Map(emaSlow.map((p) => [p.time, p.value]));
  const macd: IndicatorPoint[] = [];
  for (const f of emaFast) {
    const s = slowMap.get(f.time);
    if (s != null) macd.push({ time: f.time, value: round(f.value - s) });
  }

  const signal = emaFromPoints(macd, signalPeriod);
  const signalMap = new Map(signal.map((p) => [p.time, p.value]));
  const histogram: IndicatorPoint[] = macd
    .filter((m) => signalMap.has(m.time))
    .map((m) => ({
      time: m.time,
      value: round(m.value - (signalMap.get(m.time) ?? 0)),
    }));

  return { macd, signal, histogram };
}

function emaFromPoints(points: IndicatorPoint[], period: number): IndicatorPoint[] {
  if (points.length < period) return [];
  const k = 2 / (period + 1);
  const out: IndicatorPoint[] = [];
  let ema = points.slice(0, period).reduce((s, p) => s + p.value, 0) / period;
  out.push({ time: points[period - 1].time, value: round(ema) });
  for (let i = period; i < points.length; i++) {
    ema = points[i].value * k + ema * (1 - k);
    out.push({ time: points[i].time, value: round(ema) });
  }
  return out;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeRiskReward(signal: {
  entry_zone: { low: number; high: number } | null;
  stop_loss: number | null;
  take_profit: number[];
}) {
  if (!signal.entry_zone || signal.stop_loss == null || signal.take_profit.length === 0) return null;
  const entry = (signal.entry_zone.low + signal.entry_zone.high) / 2;
  const risk = Math.abs(entry - signal.stop_loss);
  if (risk < 0.01) return null;
  const rewards = signal.take_profit.map((tp) => Math.abs(tp - entry) / risk);
  return { entry, risk, rewards };
}
