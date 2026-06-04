import "server-only";
import { getAgentTrainingBrief } from "@/lib/ai/agent-knowledge";
import { readAppSettings } from "@/lib/finance/settings";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { buildReplyAgentSystemPrompt } from "@/lib/ai/reply-agent-prompt";
import type { CustomerReplyInput, CustomerReplyResult, ReplyTone } from "@/lib/ai/customer-reply";
import { getKnowledgeAwareFallbackReply } from "@/lib/ai/knowledge-aware-fallback";

function buildUserPrompt(params: CustomerReplyInput) {
  const parts = [
    "TASK: Write 3 conversion-optimized replies for this inbound message.",
    "",
    `Client name: ${params.clientName}`,
    `Channel: ${params.channel}`,
    `Tone setting: ${params.tone ?? "professional"}`,
    "",
    "Customer question:",
    params.customerQuestion.trim(),
  ];
  if (params.conversationHistory?.trim()) {
    parts.push("", "Recent conversation:", params.conversationHistory.trim());
  }
  if (params.clientNotes?.trim()) {
    parts.push("", "CRM notes about this client:", params.clientNotes.trim());
  }
  return parts.join("\n");
}

function parseNumberedLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);
}

function guessLanguage(text: string) {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  return "en";
}

function mockReply(params: CustomerReplyInput): CustomerReplyResult {
  const zh = guessLanguage(params.customerQuestion) === "zh";
  return {
    detectedLanguage: zh ? "zh" : "en",
    replies: zh
      ? [
          `${params.clientName} 您好，感谢联系 AXPM。我会尽快为您核实并回复准确信息。`,
          `${params.clientName} 您好，问题已收到。请问您方便提供注册邮箱以便我为您查询吗？`,
          `如有紧急需求请直接回复，我会优先处理。`,
        ]
      : [
          `Hi ${params.clientName}, thank you for reaching out to AXPM. I'll verify the details and reply with accurate information shortly.`,
          `Hi ${params.clientName}, noted — could you share your registered email so I can look this up for you?`,
          `Reply here anytime if anything is urgent and I'll prioritise it.`,
        ],
  };
}

export async function generateDeepSeekCustomerReply(
  params: CustomerReplyInput,
): Promise<CustomerReplyResult & { fallback?: boolean; notice?: string; provider?: string }> {
  const trainingBrief = params.customBrief ?? (await getAgentTrainingBrief());
  const settings = await readAppSettings();
  const manualBrief = settings.replyAgentPrompt?.trim();
  const customBrief = [trainingBrief, manualBrief].filter(Boolean).join("\n\n");

  const result = await deepSeekChat({
    json: true,
    messages: [
      {
        role: "system",
        content: buildReplyAgentSystemPrompt({
          channel: params.channel,
          tone: params.tone as ReplyTone | undefined,
          language: params.language,
          customBrief: customBrief || undefined,
        }),
      },
      { role: "user", content: buildUserPrompt({ ...params, customBrief: customBrief || undefined }) },
    ],
  });

  if (!result.ok) {
    const offline =
      getKnowledgeAwareFallbackReply({ ...params, customBrief: customBrief || undefined }) ??
      mockReply(params);
    const zh = guessLanguage(params.customerQuestion) === "zh";
    return {
      ...offline,
      fallback: true,
      provider: "fallback",
      notice: zh
        ? `DeepSeek 未连接：${result.error}`
        : `DeepSeek unreachable: ${result.error}`,
    };
  }

  try {
    const parsed = JSON.parse(result.content) as {
      replies?: string[];
      detectedLanguage?: string;
    };
    const replies = (parsed.replies ?? [])
      .map((r) => String(r).trim())
      .filter(Boolean)
      .slice(0, 3);
    if (replies.length > 0) {
      return {
        replies,
        detectedLanguage:
          parsed.detectedLanguage ?? guessLanguage(params.customerQuestion),
        provider: "deepseek",
      };
    }
  } catch {
    // fall through
  }

  const lineReplies = parseNumberedLines(result.content).slice(0, 3);
  if (lineReplies.length > 0) {
    return {
      replies: lineReplies,
      detectedLanguage: guessLanguage(params.customerQuestion),
      provider: "deepseek",
    };
  }

  return { ...mockReply(params), fallback: true, provider: "fallback" };
}

export type { CustomerReplyInput };
