import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const stub = {
  daily_telegram_enabled: false,
  last_daily_sent: null,
  daily_locale: "zh",
  daily_timeframe: "M15–H1",
  updated_at: new Date().toISOString(),
};

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return NextResponse.json({
    automation: stub,
    today: new Date().toISOString().slice(0, 10),
    telegram_configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim(),
    ),
  });
}

export async function PATCH() {
  return GET();
}
