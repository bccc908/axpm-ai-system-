import "server-only";

import fs from "fs/promises";
import path from "path";
import type { GoldChartInterval } from "@/lib/gold-signals/chart-data";
import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";

type CacheEntry = {
  bars: GoldOhlcBar[];
  source: string;
  saved_at: string;
};

const memory = new Map<string, CacheEntry>();
const CACHE_PATH = path.join(process.cwd(), ".run/btc-ohlc-cache.json");

function cacheKey(interval: GoldChartInterval) {
  return interval;
}

export async function readBarsCache(interval: GoldChartInterval): Promise<CacheEntry | null> {
  const key = cacheKey(interval);
  const mem = memory.get(key);
  if (mem) return mem;

  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const all = JSON.parse(raw) as Record<string, CacheEntry>;
    const entry = all[key];
    if (entry?.bars?.length) {
      memory.set(key, entry);
      return entry;
    }
  } catch {
    /* no cache yet */
  }
  return null;
}

export async function writeBarsCache(
  interval: GoldChartInterval,
  bars: GoldOhlcBar[],
  source: string,
): Promise<void> {
  if (bars.length === 0) return;
  const key = cacheKey(interval);
  const entry: CacheEntry = { bars, source, saved_at: new Date().toISOString() };
  memory.set(key, entry);

  try {
    let all: Record<string, CacheEntry> = {};
    try {
      all = JSON.parse(await fs.readFile(CACHE_PATH, "utf8")) as Record<string, CacheEntry>;
    } catch {
      /* fresh file */
    }
    all[key] = entry;
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify(all));
  } catch {
    /* cache write is best-effort */
  }
}

export function cacheAgeMs(entry: CacheEntry | null): number | null {
  if (!entry?.saved_at) return null;
  return Date.now() - new Date(entry.saved_at).getTime();
}
