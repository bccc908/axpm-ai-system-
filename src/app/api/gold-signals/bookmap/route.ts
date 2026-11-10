import { NextResponse } from "next/server";
import { assertLocalApiAuth, LocalApiAuthError } from "@/lib/local/local-api-auth";
import { recordBridgePoll } from "@/lib/ops-floor/bridge-poll";
import { getLatestGoldSignal, toBookmapAlert } from "@/lib/gold-signals/store";

export const dynamic = "force-dynamic";

/** Bookmap add-on polls this endpoint for the latest XAUUSD signal. */
export async function GET(request: Request) {
  try {
    assertLocalApiAuth(request);
  } catch (e) {
    if (e instanceof LocalApiAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  recordBridgePoll("bookmap");
  const signal = await getLatestGoldSignal();
  if (!signal) {
    return NextResponse.json({ alert: null, message: "no signal yet" });
  }

  return NextResponse.json({
    alert: toBookmapAlert(signal),
    signal,
  });
}
