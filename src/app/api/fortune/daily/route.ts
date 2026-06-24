import { NextResponse } from "next/server";
import { runDailyFortune } from "@/lib/fortune/daily";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function handleDaily(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  try {
    const result = await runDailyFortune({ force });

    if (result.skipped) {
      return NextResponse.json({
        sent: false,
        skipped: true,
        reason: result.reason,
        today: result.today,
        last_daily_sent: "last_daily_sent" in result ? result.last_daily_sent : undefined,
      });
    }

    const partial = "partial" in result && result.partial;
    const telegramOk = !partial;

    return NextResponse.json({
      sent: telegramOk,
      skipped: false,
      partial,
      today: result.today,
      usedAi: "usedAi" in result ? result.usedAi : undefined,
      reading: result.reading
        ? { id: result.reading.id, title: result.reading.title }
        : undefined,
      telegram: partial
        ? { sent: false, error: result.telegram.error }
        : { sent: true },
    });
  } catch (error) {
    console.error("[Fortune daily]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily fortune failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleDaily(request);
}

export async function POST(request: Request) {
  if (process.env.CRON_SECRET?.trim() && !isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleDaily(request);
}
