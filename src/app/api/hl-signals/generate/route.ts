import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { generateHlSignal } from "@/lib/hl-signals/signal-engine";
import { sendHlSignalTelegram } from "@/lib/hl-signals/telegram";

const bodySchema = z.object({
  locale: z.enum(["en", "zh"]).optional(),
  timeframe: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  spot_override: z.number().positive().optional(),
  include_news: z.boolean().optional(),
});

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const locale = parsed.data.locale ?? "zh";
  const result = await generateHlSignal({
    locale,
    timeframe: parsed.data.timeframe,
    notes: parsed.data.notes,
    spotOverride: parsed.data.spot_override,
    includeNews: parsed.data.include_news,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const telegram = await sendHlSignalTelegram(result.signal);
  return NextResponse.json({ signal: result.signal, quote: result.quote, telegram });
}
