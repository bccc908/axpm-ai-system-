import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { analyzeFortuneFeedback } from "@/lib/fortune/analyze-feedback";
import {
  fortuneScopeForRole,
  getScopedFortuneReadingById,
} from "@/lib/fortune/context";

const bodySchema = z.object({
  reading_id: z.string().min(1).max(120),
  actual_outcome: z.string().min(4).max(2000),
  locale: z.enum(["en", "zh"]).optional(),
});

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "请先说说今天实际发生了什么" }, { status: 400 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const reading = await getScopedFortuneReadingById(scope, parsed.data.reading_id);
  if (!reading) {
    return NextResponse.json({ error: "找不到这条分析" }, { status: 404 });
  }

  const locale = parsed.data.locale ?? "zh";
  const analyzed = await analyzeFortuneFeedback({
    reading,
    actualOutcome: parsed.data.actual_outcome,
    locale,
  });

  if (!analyzed.ok) {
    return NextResponse.json({ error: analyzed.error }, { status: 400 });
  }

  return NextResponse.json({ analysis: analyzed.result });
}
