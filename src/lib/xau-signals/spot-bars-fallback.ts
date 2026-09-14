import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import { fetchExchangeSpot } from "@/lib/xau-signals/binance-fetch";

export async function fetchSpotFallbackBars(count = 120): Promise<{
  bars: GoldOhlcBar[];
  source: string;
} | null> {
  try {
    const exchange = await fetchExchangeSpot();
    const spot = exchange?.price;
    if (!Number.isFinite(spot) || !spot || spot <= 0) return null;
    return buildSyntheticBars(spot, count, `${exchange!.source} (est.)`);
  } catch {
    return null;
  }
}

function buildSyntheticBars(spot: number, count: number, source: string) {
  const now = Math.floor(Date.now() / 1000);
  const step = 60;
  const bars: GoldOhlcBar[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * step;
    const wobble = Math.sin(i / 5) * 2.4 + Math.cos(i / 8) * 1.8;
    const open =
      i === count - 1
        ? Math.round((spot - wobble) * 100) / 100
        : bars[bars.length - 1].close;
    const close = Math.round((spot + wobble) * 100) / 100;
    const high = Math.round((Math.max(open, close) + 1.2) * 100) / 100;
    const low = Math.round((Math.min(open, close) - 1.2) * 100) / 100;
    bars.push({
      time: t - (t % step),
      open,
      high,
      low,
      close,
      volume: 100 + ((i * 17) % 90),
    });
  }

  return { bars, source };
}
