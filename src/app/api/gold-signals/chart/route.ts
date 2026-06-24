import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchGoldOhlc, type GoldChartInterval } from "@/lib/gold-signals/chart-data";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  interval: z.enum(["1m", "5m", "15m", "1h", "4h"]).optional(),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse({
    interval: new URL(request.url).searchParams.get("interval") ?? undefined,
  });
  const interval = (parsed.success ? parsed.data.interval : "5m") as GoldChartInterval;

  try {
    const data = await fetchGoldOhlc(interval);
    const last = data.bars.at(-1);
    return NextResponse.json({
      ...data,
      last,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "chart fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
