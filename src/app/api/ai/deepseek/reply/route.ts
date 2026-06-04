import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentTrainingBrief } from "@/lib/ai/agent-knowledge";
import { generateDeepSeekCustomerReply } from "@/lib/ai/deepseek-reply";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.enum(["whatsapp", "wechat", "telegram", "email", "phone"]),
  clientName: z.string().min(1),
  customerQuestion: z.string().min(1),
  conversationHistory: z.string().optional(),
  context: z.string().optional(),
  clientNotes: z.string().optional(),
  language: z.string().optional(),
  tone: z.enum(["professional", "friendly", "concise"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const history =
      parsed.data.conversationHistory?.trim() ||
      parsed.data.context?.trim() ||
      "";

    const trainingBrief = await getAgentTrainingBrief();
    const result = await generateDeepSeekCustomerReply({
      channel: parsed.data.channel,
      clientName: parsed.data.clientName,
      customerQuestion: parsed.data.customerQuestion.trim(),
      conversationHistory: history || undefined,
      clientNotes: parsed.data.clientNotes,
      language: parsed.data.language,
      tone: parsed.data.tone,
      customBrief: trainingBrief || undefined,
    });

    const usedTrainingDocs =
      Boolean(trainingBrief?.trim()) && Boolean(result.fallback);

    return NextResponse.json({
      ok: !result.fallback,
      provider: "deepseek",
      suggestions: result.replies,
      detectedLanguage: result.detectedLanguage,
      fallback: result.fallback ?? false,
      notice: result.notice ?? null,
      usedTrainingDocs,
      deepseekReachable: !result.fallback,
    });
  } catch (error) {
    console.error("[DeepSeek Reply]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DeepSeek reply failed" },
      { status: 500 },
    );
  }
}
