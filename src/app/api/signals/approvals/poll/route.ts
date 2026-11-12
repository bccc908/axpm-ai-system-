import { NextResponse } from "next/server";
import { redactTelegramSecrets } from "@/lib/integrations/telegram";
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
  if (!result.ok) {
    const body = {
      error: redactTelegramSecrets(result.error),
      error_code: result.error_code,
      description: result.description === null ? null : redactTelegramSecrets(result.description),
      http_status: result.http_status,
      attempts: result.attempts,
    };
    // pm2 keeps stderr: this line is what explains a 502 later (409 conflict vs Telegram/network).
    console.error(`[approvals/poll] getUpdates failed ${JSON.stringify(body)}`);
    return NextResponse.json(body, { status: 502 });
  }
  return NextResponse.json(result);
}
