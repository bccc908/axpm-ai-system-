import { NextResponse } from "next/server";
import { fetchGoldSpreadSnapshot } from "@/lib/gold-spread/quotes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await fetchGoldSpreadSnapshot();
    if (!snap) {
      return NextResponse.json({ error: "quote unavailable" }, { status: 502 });
    }
    return NextResponse.json({
      price: snap.xauusdt,
      change_pct: snap.xauusdt_change_pct,
      source: `${snap.xauusd_source} / ${snap.xauusdt_source}`,
      ...snap,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "quote fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
