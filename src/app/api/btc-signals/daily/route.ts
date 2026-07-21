import { NextResponse } from "next/server";
import { runDailyBtcSignal } from "@/lib/btc-signals/daily";

export const maxDuration = 120;
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
    const result = await runDailyBtcSignal({ force });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, today: result.today }, { status: 500 });
    }

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

    return NextResponse.json({
      sent: !partial,
      skipped: false,
      partial,
      today: result.today,
      signal: result.signal
        ? { id: result.signal.id, bias: result.signal.bias, confidence: result.signal.confidence }
        : undefined,
      telegram: partial
        ? { sent: false, error: result.telegram.error }
        : { sent: true },
    });
  } catch (error) {
    console.error("[BTC daily]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily BTC signal failed" },
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
