import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import {
  getHlSignalAutomation,
  hlTodayKey,
  saveHlSignalAutomation,
} from "@/lib/hl-signals/automation";
import { runDailyHlSignal } from "@/lib/hl-signals/daily";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  daily_telegram_enabled: z.boolean().optional(),
  daily_locale: z.enum(["zh", "en"]).optional(),
  daily_timeframe: z.string().max(40).optional(),
  send_now: z.boolean().optional(),
});

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const automation = await getHlSignalAutomation();
  return NextResponse.json({
    automation,
    today: hlTodayKey(),
    telegram_configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim(),
    ),
  });
}

export async function PATCH(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "参数无效" }, { status: 400 });
  const { send_now, ...patch } = parsed.data;
  const automation = await saveHlSignalAutomation(patch);
  if (send_now) {
    const result = await runDailyHlSignal({ force: true });
    return NextResponse.json({ automation, result });
  }
  return NextResponse.json({ automation });
}
