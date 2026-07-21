import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import { fetchExchangeSpot } from "@/lib/eth-signals/binance-fetch";

/** Last-resort 1m bars from live ETH spot when Yahoo is unavailable. */
export async function fetchSpotFallbackBars(count = 120): Promise<{
  bars: GoldOhlcBar[];
  source: string;
} | null> {
  try {
    const exchange = await fetchExchangeSpot();
    const spot = exchange?.price;
    if (!Number.isFinite(spot) || !spot || spot <= 0) {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { ethereum?: { usd?: number } };
      const cg = data.ethereum?.usd;
      if (!Number.isFinite(cg) || !cg || cg <= 0) return null;
      return buildSyntheticBars(cg, count, "ETH-USD (est.)");
    }
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
    const wobble = Math.sin(i / 5) * 4.5 + Math.cos(i / 8) * 3.5;
    const open =
      i === count - 1
        ? Math.round((spot - wobble) * 100) / 100
        : bars[bars.length - 1].close;
    const close = Math.round((spot + wobble) * 100) / 100;
    const high = Math.round((Math.max(open, close) + 2.5) * 100) / 100;
    const low = Math.round((Math.min(open, close) - 2.5) * 100) / 100;
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
