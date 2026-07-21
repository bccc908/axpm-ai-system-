import { NextResponse } from "next/server";
import { fetchEthSpotQuote } from "@/lib/eth-signals/price";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const quote = await fetchEthSpotQuote();
    if (!quote) {
      return NextResponse.json({ error: "quote unavailable" }, { status: 502 });
    }
    return NextResponse.json(quote);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "quote fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
