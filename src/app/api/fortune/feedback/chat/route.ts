import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import {
  fortuneScopeForRole,
  getScopedFortuneReadingById,
  getScopedFeedbackChat,
  sendScopedFeedbackChat,
} from "@/lib/fortune/context";
import { kickoffFeedbackChatAudit } from "@/lib/fortune/feedback-chat";

const bodySchema = z
  .object({
    reading_id: z.string().min(1).max(120),
    message: z.string().max(2000).optional(),
    kickoff: z.boolean().optional(),
    locale: z.enum(["en", "zh"]).optional(),
  })
  .refine((data) => data.kickoff || (data.message?.trim().length ?? 0) > 0, {
    message: "message required",
  });

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const readingId = new URL(request.url).searchParams.get("readingId");
  if (!readingId) {
    return NextResponse.json({ error: "readingId required" }, { status: 400 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const session = await getScopedFeedbackChat(scope, readingId);
  return NextResponse.json({ session });
}

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入消息" }, { status: 400 });
  }

  const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
  const reading = await getScopedFortuneReadingById(scope, parsed.data.reading_id);
  if (!reading) {
    return NextResponse.json({ error: "找不到这条分析" }, { status: 404 });
  }

  const locale = parsed.data.locale ?? "zh";

  if (parsed.data.kickoff) {
    const result = await kickoffFeedbackChatAudit({
      userId: scope.userId,
      reading,
      locale,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ session: result.session, reply: result.reply });
  }

  const result = await sendScopedFeedbackChat(scope, {
    reading,
    message: parsed.data.message!.trim(),
    locale,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ session: result.session, reply: result.reply });
}
