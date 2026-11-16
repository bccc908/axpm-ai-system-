import "server-only";

export type XauPrint = {
  time: number;
  px: number;
  side: "buy" | "sell";
  sz: number;
};

const cache: { prints: XauPrint[]; at: number } = { prints: [], at: 0 };
let inflight: Promise<XauPrint[]> | null = null;
const TTL_MS = 120;

function parseEmClock(hms: string): number {
  const [hh, mm, ss] = hms.split(":").map((x) => Number(x));
  if (![hh, mm, ss].every((n) => Number.isFinite(n))) return Date.now();
  const now = new Date();
  const stamp = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hh,
    mm,
    ss,
    0,
  ).getTime();
  if (stamp - Date.now() > 12 * 60 * 60 * 1000) return stamp - 86_400_000;
  return stamp;
}

export async function fetchEmXauPrints(limit = 150): Promise<XauPrint[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS && cache.prints.length) return cache.prints;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(
        `https://push2.eastmoney.com/api/qt/stock/details/get?secid=122.XAU&pos=-${Math.min(200, Math.max(40, limit))}&fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(4_000),
        },
      );
      if (!res.ok) return cache?.prints ?? [];
      const json = (await res.json()) as { data?: { details?: string[] } };
      const rows = json.data?.details ?? [];
      const prints: XauPrint[] = [];
      for (const row of rows) {
        const [hms, pxRaw, szRaw, , flagRaw] = row.split(",");
        const px = Number(pxRaw);
        if (!(px > 0) || !hms) continue;
        const sz = Number(szRaw);
        const flag = Number(flagRaw);
        prints.push({
          time: parseEmClock(hms),
          px: Math.round(px * 100) / 100,
          side: flag === 1 ? "sell" : "buy",
          sz: sz > 0 ? sz : 1,
        });
      }
      prints.sort((a, b) => b.time - a.time);
      const sliced = prints.slice(0, limit);
      if (sliced.length) Object.assign(cache, { prints: sliced, at: Date.now() });
      return sliced;
    } catch {
      return cache?.prints ?? [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
