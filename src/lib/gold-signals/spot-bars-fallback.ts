import "server-only";

import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";

/** Last-resort 1m bars from live XAU spot when Yahoo is unavailable. */
export async function fetchSpotFallbackBars(count = 120): Promise<{
  bars: GoldOhlcBar[];
  source: string;
} | null> {
  try {
    const res = await fetch("https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      symbols?: Array<{ price?: string; bid?: string; ask?: string }>;
    };
    const row = data.symbols?.[0];
    const spot = Number(row?.price ?? row?.bid ?? row?.ask);
    if (!Number.isFinite(spot) || spot <= 0) return null;

    const now = Math.floor(Date.now() / 1000);
    const step = 60;
    const bars: GoldOhlcBar[] = [];

    for (let i = count - 1; i >= 0; i--) {
      const t = now - i * step;
      const wobble = Math.sin(i / 5) * 0.45 + Math.cos(i / 8) * 0.35;
      const open =
        i === count - 1
          ? Math.round((spot - wobble) * 100) / 100
          : bars[bars.length - 1].close;
      const close = Math.round((spot + wobble) * 100) / 100;
      const high = Math.round((Math.max(open, close) + 0.25) * 100) / 100;
      const low = Math.round((Math.min(open, close) - 0.25) * 100) / 100;
      bars.push({
        time: t - (t % step),
        open,
        high,
        low,
        close,
        volume: 100 + ((i * 17) % 90),
      });
    }

    return { bars, source: "XAU-USD-SPOT (est.)" };
  } catch {
    return null;
  }
}
