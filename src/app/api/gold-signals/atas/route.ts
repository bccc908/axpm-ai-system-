import { NextResponse } from "next/server";
import { assertLocalApiAuth, LocalApiAuthError } from "@/lib/local/local-api-auth";
import { getLatestGoldSignal, toAtasAlert } from "@/lib/gold-signals/store";

export const dynamic = "force-dynamic";

/** ATAS sidecar / indicator polls this for latest XAUUSD levels + playbook. */
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
    alert: toAtasAlert(signal),
    signal,
  });
}
