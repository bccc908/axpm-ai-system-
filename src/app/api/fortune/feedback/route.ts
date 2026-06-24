import { NextResponse } from "next/server";
import { z } from "zod";
import { computeFeedbackStats } from "@/lib/fortune/feedback-stats";
import { getServerSession } from "@/lib/auth/api-session";
import {
  fortuneScopeForRole,
  getScopedFortuneFeedback,
  getScopedFortuneReadingById,
  listScopedFortuneFeedback,
  saveScopedFortuneFeedback,
} from "@/lib/fortune/context";

const bodySchema = z.object({
  reading_id: z.string().min(1).max(120),
  rating: z.enum(["accurate", "partial", "wrong"]),
  actual_outcome: z.string().max(2000).nullable().optional(),
  errors: z.string().max(2000).nullable().optional(),
  correction_notes: z.string().max(2000).nullable().optional(),
  chat_messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        created_at: z.string(),
      }),
    )
    .optional(),
});

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const readingId = new URL(request.url).searchParams.get("readingId");

  if (readingId) {
    const feedback = await getScopedFortuneFeedback(scope, readingId);
    return NextResponse.json({ feedback });
  }

  const entries = await listScopedFortuneFeedback(scope, 50);
  return NextResponse.json({ entries, stats: computeFeedbackStats(entries) });
}

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "请先登录后再保存复盘" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "数据格式有误，请刷新页面后重试" }, { status: 400 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const reading = await getScopedFortuneReadingById(scope, parsed.data.reading_id);
  if (!reading) {
    return NextResponse.json({ error: "找不到这条分析，请刷新页面后重试" }, { status: 404 });
  }

  const feedback = await saveScopedFortuneFeedback(scope, { ...parsed.data, chat_messages: parsed.data.chat_messages }, reading);
  return NextResponse.json({ feedback });
}
