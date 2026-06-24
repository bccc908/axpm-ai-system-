import { NextResponse } from "next/server";
import { assertLocalApiAuth, LocalApiAuthError } from "@/lib/local/local-api-auth";
import { getLatestGoldSignal, toMt5Alert } from "@/lib/gold-signals/store";

export const dynamic = "force-dynamic";

/** MetaTrader 5 EA / script polls this for latest XAUUSD levels + optional auto-trade hints. */
export async function GET(request: Request) {
  try {
    assertLocalApiAuth(request);
  } catch (e) {
    if (e instanceof LocalApiAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  const signal = await getLatestGoldSignal();
  if (!signal) {
    return NextResponse.json({ alert: null, message: "no signal yet" });
  }

  return NextResponse.json({
    alert: toMt5Alert(signal),
    signal,
  });
}
