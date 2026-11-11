import { NextResponse } from "next/server";
import { z } from "zod";
import { openAiErrorMessage } from "@/lib/ai/client";
import { generateCustomerReply } from "@/lib/ai/customer-reply";
import { generateDeepSeekCustomerReply } from "@/lib/ai/deepseek-reply";
import { generateReplySuggestion } from "@/lib/ai/openai";
import { getAgentTrainingBrief } from "@/lib/ai/agent-knowledge";
import { getLlmProvider } from "@/lib/ai/llm-config";
import { getReplyProvider, isOpenClawConfigured } from "@/lib/ai/openclaw-config";
import { storePendingReplyDraft } from "@/lib/support/draft-approval";

/** Allow slow OpenAI calls (default Next timeout is too short) */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.enum(["whatsapp", "wechat", "telegram", "email", "phone", "web"]),
  clientName: z.string().min(1),
  clientId: z.string().optional(),
  customerQuestion: z.string().min(1).optional(),
  context: z.string().optional(),
  conversationHistory: z.string().optional(),
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

    if (parsed.data.customerQuestion?.trim()) {
      const trainingBrief = await getAgentTrainingBrief();
      const input = {
        channel: parsed.data.channel,
        clientName: parsed.data.clientName,
        customerQuestion: parsed.data.customerQuestion.trim(),
        conversationHistory: history || undefined,
        clientNotes: parsed.data.clientNotes,
        language: parsed.data.language,
        tone: parsed.data.tone,
        customBrief: trainingBrief || undefined,
      };

      const llmProvider = getLlmProvider();
      const replyProvider = getReplyProvider();
      const preferOpenClaw =
        llmProvider !== "deepseek" &&
        (replyProvider === "openclaw" ||
          (replyProvider === "auto" && isOpenClawConfigured()));

      const result =
        llmProvider === "deepseek"
          ? await generateDeepSeekCustomerReply(input)
          : preferOpenClaw
            ? await generateCustomerReply(input)
            : await generateCustomerReply(input);

      const usedTrainingDocs =
        Boolean(trainingBrief?.trim()) && Boolean(result.fallback);
      const provider =
        result.provider ??
        (result.fallback ? "fallback" : preferOpenClaw ? "openclaw" : getLlmProvider());
      const notice =
        "notice" in result && typeof result.notice === "string"
          ? result.notice
          : null;
      const draft = await storePendingReplyDraft({
        channel: parsed.data.channel,
        clientName: parsed.data.clientName,
        clientId: parsed.data.clientId,
        customerQuestion: parsed.data.customerQuestion.trim(),
        conversationHistory: history || undefined,
        replies: result.replies,
        provider,
        fallback: Boolean(result.fallback),
        notice,
        source: "reply_agent",
      });
      return NextResponse.json({
        suggestions: result.replies,
        detectedLanguage: result.detectedLanguage,
        mode: result.fallback ? "fallback" : "agent",
        fallback: result.fallback ?? false,
        provider,
        notice,
        usedTrainingDocs,
        openaiReachable: !result.fallback,
        llmReachable: !result.fallback,
        draft: draft
          ? {
              id: draft.id,
              status: draft.status,
              notifiedTelegram: draft.notifiedTelegram,
              telegramError: draft.telegramError,
            }
          : null,
      });
    }

    const suggestions = await generateReplySuggestion({
      channel: parsed.data.channel,
      clientName: parsed.data.clientName,
      context: history || "General follow-up",
      language: parsed.data.language,
    });

    return NextResponse.json({ suggestions, mode: "legacy" });
  } catch (error) {
    console.error("[AI Reply]", error);
    return NextResponse.json(
      { error: openAiErrorMessage(error), ok: false },
      { status: 500 },
    );
  }
}
