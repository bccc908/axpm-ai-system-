import "server-only";

import { fetchGoldSpotQuote } from "@/lib/gold-signals/price";
import { fetchXauSpotQuote } from "@/lib/xau-signals/price";
import type { GoldSpreadLeader, GoldSpreadSnapshot } from "@/types/gold-spread-signal";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function fetchGoldSpreadSnapshot(): Promise<GoldSpreadSnapshot | null> {
  const [usd, usdt] = await Promise.all([fetchGoldSpotQuote(), fetchXauSpotQuote()]);
  if (!usd || !usdt) return null;

  const spread = round2(usdt.price - usd.price);
  const spread_pct = usd.price > 0 ? round2((spread / usd.price) * 100) : 0;
  const usdCh = usd.change_pct;
  const usdtCh = usdt.change_pct;

  let leader: GoldSpreadLeader = "aligned";
  if (usdCh != null && usdtCh != null) {
    const diff = usdtCh - usdCh;
    if (diff > 0.08) leader = "xauusdt";
    else if (diff < -0.08) leader = "xauusd";
  } else if (Math.abs(spread_pct) >= 0.04) {
    leader = spread > 0 ? "xauusdt" : "xauusd";
  }

  return {
    xauusd: usd.price,
    xauusdt: usdt.price,
    spread,
    spread_pct,
    xauusd_change_pct: usdCh,
    xauusdt_change_pct: usdtCh,
    leader,
    xauusd_source: usd.source,
    xauusdt_source: usdt.source,
    as_of: new Date().toISOString(),
  };
}
