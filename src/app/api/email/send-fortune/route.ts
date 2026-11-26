import { NextResponse } from "next/server";
import { sendDailyFortuneEmail } from "@/lib/integrations/email";
import { OWNER_ADMIN, allowCronOrRoles } from "@/lib/auth/route-guard";

async function isAuthorized(request: Request) {
  return allowCronOrRoles(request, OWNER_ADMIN);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sendFortune();
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
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
