import { NextResponse } from "next/server";
import { runDailyFortune } from "@/lib/fortune/daily";
import { cronRequestAuthorized } from "@/lib/auth/secrets";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  return cronRequestAuthorized(request);
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
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleDaily(request);
}
