import { NextResponse } from "next/server";
import { z } from "zod";
import { runDailyFortune } from "@/lib/fortune/daily";
import {
  fortuneScopeForRole,
  getScopedFortuneAutomation,
  saveScopedFortuneAutomation,
} from "@/lib/fortune/context";
import { getServerSession } from "@/lib/auth/api-session";
import { getTelegramConfig } from "@/lib/integrations/telegram";

const schema = z.object({
  daily_telegram_enabled: z.boolean().optional(),
  question_telegram_enabled: z.boolean().optional(),
  daily_locale: z.enum(["en", "zh"]).optional(),
});

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const [automation, telegram] = await Promise.all([
    getScopedFortuneAutomation(scope),
    Promise.resolve(getTelegramConfig()),
  ]);
  return NextResponse.json({ automation, telegram });
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getServerSession();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
    const automation = await saveScopedFortuneAutomation(scope, parsed.data);
    return NextResponse.json({ automation });
  } catch (error) {
    console.error("[Fortune automation PATCH]", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getServerSession();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (ctx.user.role !== "owner") {
      return NextResponse.json({ error: "Owner only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const force = Boolean((body as { force?: boolean }).force);
    const result = await runDailyFortune({ force, ownerUserId: ctx.user.id });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Fortune automation POST]", error);
    return NextResponse.json({ error: "Failed to send daily fortune" }, { status: 500 });
  }
}
