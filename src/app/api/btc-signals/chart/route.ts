import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchBtcOhlc,
  type GoldChartInterval,
  type GoldChartRange,
} from "@/lib/btc-signals/chart-data";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  interval: z.enum(["1m", "5m", "15m", "1h", "4h"]).optional(),
  range: z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y", "max"]).optional(),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    interval: params.get("interval") ?? undefined,
    range: params.get("range") ?? undefined,
  });
  const interval = (parsed.success ? parsed.data.interval : "5m") as GoldChartInterval;
  const range = parsed.success ? (parsed.data.range as GoldChartRange | undefined) : undefined;

  try {
    const data = await fetchBtcOhlc(interval, range);
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
