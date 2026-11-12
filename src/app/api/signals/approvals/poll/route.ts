import { NextResponse } from "next/server";
import { pollApprovalCallbacks } from "@/lib/signal-approval";

export const dynamic = "force-dynamic";

/** Requires CRON_SECRET to be set AND supplied. Unlike older cron routes, an unset secret means closed. */
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

/** Reads Approve / Reject taps from Kayden's Telegram chat and records them. Sends no new messages. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await pollApprovalCallbacks();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
