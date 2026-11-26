import { NextResponse } from "next/server";
import { buildDailyDigestMessage } from "@/lib/digest/daily-digest";
import { sendDailyDigestEmail } from "@/lib/integrations/email";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { runFinanceAutomation } from "@/lib/finance/store";
import { isFinanceAutoMode } from "@/lib/finance/settings";
import { OWNER_ADMIN, allowCronOrRoles } from "@/lib/auth/route-guard";

async function isAuthorized(request: Request) {
  return allowCronOrRoles(request, OWNER_ADMIN);
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sendDigest();
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sendDigest();
}

async function sendDigest() {
  try {
    let financeAuto: Awaited<ReturnType<typeof runFinanceAutomation>> | undefined;
    if (await isFinanceAutoMode()) {
      financeAuto = await runFinanceAutomation();
    }

    const message = await buildDailyDigestMessage(financeAuto);
    const [telegramResult, emailResult] = await Promise.all([
      sendTelegramMessage(message),
      sendDailyDigestEmail(),
    ]);

    const telegramOk = telegramResult.ok;
    const emailOk = emailResult.ok;

    if (!telegramOk && !emailOk) {
      return NextResponse.json(
        {
          sent: false,
          telegram: { sent: false, error: telegramResult.ok ? undefined : telegramResult.error },
          email: { sent: false, error: emailResult.ok ? undefined : emailResult.error },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      sent: true,
      telegram: { sent: telegramOk, error: telegramOk ? undefined : telegramResult.error },
      email: {
        sent: emailOk,
        error: emailOk ? undefined : emailResult.error,
        skipped: !emailOk && "error" in emailResult,
      },
    });
  } catch (error) {
    console.error("[Daily Digest]", error);
    return NextResponse.json({ error: "Failed to send daily digest" }, { status: 500 });
  }
}
