import type { Channel } from "@/types/database";
import { getOpenAI, getChatModel } from "@/lib/ai/client";
import { getLlmDisplayName, getLlmProvider } from "@/lib/ai/llm-config";
import { getKnowledgeAwareFallbackReply } from "@/lib/ai/knowledge-aware-fallback";
import {
  getCachedOpenAIReachable,
  isOpenAIReachable,
} from "@/lib/ai/openai-reachable";
import { openClawChatCompletion } from "@/lib/ai/openclaw-client";
import {
  getCachedOpenClawReachable,
  isOpenClawReachable,
} from "@/lib/ai/openclaw-reachable";
import {
  getReplyProvider,
  isOpenClawConfigured,
} from "@/lib/ai/openclaw-config";
import { buildReplyAgentSystemPrompt } from "@/lib/ai/reply-agent-prompt";

export type ReplyTone = "professional" | "friendly" | "concise";

export type CustomerReplyInput = {
  channel: Channel;
  clientName: string;
  customerQuestion: string;
  conversationHistory?: string;
  clientNotes?: string;
  language?: string;
  tone?: ReplyTone;
  /** Team-specific instructions from Settings */
  customBrief?: string;
};

export type CustomerReplyResult = {
  replies: string[];
  detectedLanguage: string;
  provider?: "openclaw" | "openai" | "deepseek" | "fallback";
};

export async function generateCustomerReply(
  params: CustomerReplyInput,
): Promise<CustomerReplyResult & { fallback?: boolean }> {
  const offlineReply = () =>
    getKnowledgeAwareFallbackReply(params) ?? getMockCustomerReply(params);

  const hasTraining = Boolean(params.customBrief?.trim());
  const providerPref = getReplyProvider();

  if (providerPref === "openclaw" || (providerPref === "auto" && isOpenClawConfigured())) {
    const openClawResult = await tryOpenClawReply(params);
    if (openClawResult) return openClawResult;
    if (providerPref === "openclaw") {
      return withFallbackNotice(offlineReply(), params.customerQuestion, hasTraining, "openclaw");
    }
  }

  const openai = getOpenAI();
  if (!openai) {
    return withFallbackNotice(offlineReply(), params.customerQuestion, hasTraining);
  }

  const cachedReachable = getCachedOpenAIReachable();
  if (cachedReachable === false && hasTraining) {
    return withFallbackNotice(offlineReply(), params.customerQuestion, true);
  }

  const reachable = cachedReachable ?? (await isOpenAIReachable());
  if (!reachable) {
    return withFallbackNotice(offlineReply(), params.customerQuestion, hasTraining);
  }

  try {
    const response = await openai.chat.completions.create({
      model: getChatModel(),
      messages: [
        {
          role: "system",
          content: buildReplyAgentSystemPrompt({
            channel: params.channel,
            tone: params.tone,
            language: params.language,
            customBrief: params.customBrief,
          }),
        },
        {
          role: "user",
          content: buildUserPrompt(params),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.45,
      max_tokens: 900,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw) as {
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
          provider: getLlmProvider(),
        };
      }
    } catch {
      // fall through to line parse
    }

    return {
      replies: parseNumberedLines(raw).slice(0, 3),
      detectedLanguage: guessLanguage(params.customerQuestion),
      provider: getLlmProvider(),
    };
  } catch (error) {
    console.error("[generateCustomerReply]", error);
    return withFallbackNotice(
      offlineReply(),
      params.customerQuestion,
      Boolean(params.customBrief),
    );
  }
}

export function getFallbackNotice(
  customerQuestion: string,
  usedTrainingDocs: boolean,
  provider?: "openclaw",
): string {
  const zh = guessLanguage(customerQuestion) === "zh";
  if (provider === "openclaw") {
    return zh
      ? "OpenClaw 网关未连接。请启动 openclaw gateway 并启用 chatCompletions。以下为备用回复。"
      : "OpenClaw gateway unreachable. Start the gateway and enable chatCompletions. Using fallback replies.";
  }
  if (usedTrainingDocs) {
    return zh
      ? `${getLlmDisplayName()} 未连接。正在使用您上传的培训文档生成回复（可正常测试）。`
      : `${getLlmDisplayName()} offline. Using your uploaded training documents (OK for testing).`;
  }
  if (getLlmProvider() === "deepseek") {
    return zh
      ? "DeepSeek 未连接。请检查 DEEPSEEK_API_KEY 与网络。"
      : "DeepSeek unreachable. Check DEEPSEEK_API_KEY and network.";
  }
  return zh
    ? "OpenAI 未连接。以下为通用示例回复。可改用 DeepSeek（见 .env.example）。"
    : "OpenAI offline. Sample replies below. Switch to DeepSeek — see .env.example.";
}

function withFallbackNotice(
  mock: CustomerReplyResult,
  customerQuestion: string,
  usedTrainingDocs: boolean,
  forcedProvider?: "openclaw",
): CustomerReplyResult & { fallback: true; notice: string } {
  return {
    ...mock,
    replies: mock.replies,
    fallback: true,
    provider: forcedProvider ?? "fallback",
    notice: getFallbackNotice(customerQuestion, usedTrainingDocs, forcedProvider),
  };
}

async function tryOpenClawReply(
  params: CustomerReplyInput,
): Promise<(CustomerReplyResult & { fallback?: boolean }) | null> {
  if (!isOpenClawConfigured()) return null;

  const cached = getCachedOpenClawReachable();
  const reachable = cached ?? (await isOpenClawReachable());
  if (!reachable) return null;

  const completion = await openClawChatCompletion({
    user: `axpm:${params.channel}:${params.clientName}`,
    messages: [
      {
        role: "system",
        content: buildReplyAgentSystemPrompt({
          channel: params.channel,
          tone: params.tone,
          language: params.language,
          customBrief: params.customBrief,
        }),
      },
      { role: "user", content: buildUserPrompt(params) },
    ],
  });

  if (!completion?.content) return null;

  const raw = completion.content;
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(jsonText) as {
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
        provider: "openclaw",
      };
    }
  } catch {
    // fall through
  }

  const lineReplies = parseNumberedLines(raw).slice(0, 3);
  if (lineReplies.length === 0) return null;

  return {
    replies: lineReplies,
    detectedLanguage: guessLanguage(params.customerQuestion),
    provider: "openclaw",
  };
}

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

function getMockCustomerReply(params: CustomerReplyInput): CustomerReplyResult {
  const zh = guessLanguage(params.customerQuestion) === "zh";
  const q = params.customerQuestion.toLowerCase();

  if (zh) {
    if (q.includes("存款") || q.includes("入金") || q.includes("deposit")) {
      return {
        detectedLanguage: "zh",
        replies: [
          `${params.clientName} 您好，感谢咨询入金事宜。我们可以为您安排最便捷的入金方式，一般当天即可按指引完成操作。请问您更倾向于「银行转账」还是「其他已开通渠道」？确认后我立即把分步指引发给您。`,
          `${params.clientName} 您好，入金前建议先确认账户已激活。请告知预计币种与大概金额，我帮您核对最快到账方案，好吗？`,
          `小提示：准备好账户资料可加快首次入金。若您方便，回复「已开户」或「待开户」，我按您的情况一对一跟进。`,
        ],
      };
    }
    return {
      detectedLanguage: "zh",
      replies: [
        `${params.clientName} 您好，感谢您的信任。关于您的问题，我会为您核实准确信息，避免耽误您时间。请问您方便提供注册邮箱或账户编号吗？收到后我今日内回复完整方案。`,
        `${params.clientName} 您好，问题已记录。为给您最准确的答复，您更希望我先说明「流程步骤」还是「所需资料」？`,
        `我们很多客户会选择先完成一个小步骤再深入沟通。若您愿意，回复「流程」或「资料」，我按您的节奏协助。`,
      ],
    };
  }

  if (q.includes("deposit") || q.includes("withdraw")) {
    return {
      detectedLanguage: "en",
      replies: [
        `Hi ${params.clientName}, thank you for reaching out — happy to help with your ${q.includes("withdraw") ? "withdrawal" : "deposit"}. Most clients complete this smoothly once they have the right steps for their account type. Would you prefer instructions for bank transfer or another supported method? I'll send the exact guide today.`,
        `Hi ${params.clientName}, thanks for your message. Could you confirm if your account is already active and which currency you'll use? I'll reply with the fastest option for you.`,
        `Quick tip: having your account email ready speeds things up. Reply "active" or "new account" and I'll tailor the next steps for you.`,
      ],
    };
  }

  return {
    detectedLanguage: "en",
    replies: [
      `Hi ${params.clientName}, thank you for your message — I want to make sure you get a precise answer, not a generic one. I'll verify the details on my side; could you share your registered email or account ID so I can respond accurately today?`,
      `Hi ${params.clientName}, thanks for reaching out. Would it help more if I explain the process first, or the documents required? Just reply "process" or "documents".`,
      `Many clients find it easier to move one small step at a time. If you'd like, reply with your main concern and I'll prioritize that in my next message.`,
    ],
  };
}
