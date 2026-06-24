import { NextResponse } from "next/server";
import { sendDailyFortuneEmail } from "@/lib/integrations/email";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sendFortune();
}

export async function POST(request: Request) {
  if (process.env.CRON_SECRET?.trim() && !isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  return sendFortune(force);
}

async function sendFortune(force = false) {
  try {
    const result = await sendDailyFortuneEmail({ force });
    if (!result.ok) {
      return NextResponse.json({ sent: false, error: result.error }, { status: 400 });
    }
    if ("skipped" in result && result.skipped) {
      return NextResponse.json({ sent: false, skipped: true, reason: result.reason, today: result.today });
    }
    return NextResponse.json({
      sent: true,
      today: result.today,
      title: result.title,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("[Email Fortune]", error);
    return NextResponse.json({ error: "Failed to send daily fortune email" }, { status: 500 });
  }
}
