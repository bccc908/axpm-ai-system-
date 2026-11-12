import type { Channel } from "@/types/database";
import { getOpenAI, getChatModel, openAiErrorMessage, isInsufficientLlmBalance, getLlmDisplayName, getLlmProvider } from "@/lib/ai/client";
import { buildReplyAgentSystemPrompt } from "@/lib/ai/reply-agent-prompt";

export async function generateReplySuggestion(params: {
  channel: Channel;
  clientName: string;
  context: string;
  language?: string;
}): Promise<string[]> {
  const openai = getOpenAI();
  if (!openai) {
    return getMockSuggestions(params.channel);
  }

  const channelLabel =
    params.channel === "whatsapp"
      ? "WhatsApp"
      : params.channel === "wechat"
        ? "WeChat"
        : params.channel;

  const response = await openai.chat.completions.create({
    model: getChatModel(),
    messages: [
      {
        role: "system",
        content: `${buildReplyAgentSystemPrompt({ channel: params.channel, language: params.language })}\n\nLegacy mode: output 3 numbered lines (not JSON) for ${channelLabel}.`,
      },
      {
        role: "user",
        content: `Client: ${params.clientName}\nContext: ${params.context}\n\nWrite 3 conversion-optimized replies as plain numbered lines.`,
      },
    ],
    temperature: 0.45,
  });

  const text = response.choices[0]?.message?.content ?? "";
  return text
    .split("\n")
    .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function generateReplySuggestionSafe(params: {
  channel: Channel;
  clientName: string;
  context: string;
  language?: string;
}): Promise<{
  suggestions: string[];
  fallback: boolean;
  notice: string | null;
  provider: string;
}> {
  try {
    const suggestions = await generateReplySuggestion(params);
    return {
      suggestions,
      fallback: false,
      notice: null,
      provider: getLlmProvider(),
    };
  } catch (error) {
    const raw = openAiErrorMessage(error);
    const notice = isInsufficientLlmBalance(error)
      ? `${getLlmDisplayName()} unreachable: ${raw}`
      : raw;
    return {
      suggestions: getMockSuggestions(params.channel),
      fallback: true,
      notice,
      provider: "fallback",
    };
  }
}

export async function summarizeConversation(params: {
  clientName: string;
  messages: string;
}): Promise<{ summary: string; recommendations: string[] }> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      summary: `Conversation with ${params.clientName}: Client expressed interest in account options and asked about deposit requirements.`,
      recommendations: [
        "Schedule a follow-up call within 24 hours",
        "Send account comparison document",
        "Confirm IB referral source",
      ],
    };
  }

  const response = await openai.chat.completions.create({
    model: getChatModel(),
    messages: [
      {
        role: "system",
        content:
          "Summarize this client conversation and provide 3 follow-up recommendations. Return JSON: { summary: string, recommendations: string[] }",
      },
      {
        role: "user",
        content: `Client: ${params.clientName}\n\nMessages:\n${params.messages}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  return {
    summary: parsed.summary ?? "",
    recommendations: parsed.recommendations ?? [],
  };
}

export async function analyzeLead(params: {
  clientName: string;
  leadStatus: string;
  depositAmount: number;
  notes: string | null;
  tags: string[];
}): Promise<{ score: number; analysis: string; suggestedTags: string[] }> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      score: params.depositAmount > 10000 ? 85 : params.depositAmount > 0 ? 65 : 40,
      analysis: `${params.clientName} is in "${params.leadStatus}" stage. ${params.depositAmount > 0 ? "Has made a deposit — prioritize retention." : "No deposit yet — focus on conversion."}`,
      suggestedTags: params.depositAmount > 10000 ? ["high-value", "retention"] : ["follow-up"],
    };
  }

  const response = await openai.chat.completions.create({
    model: getChatModel(),
    messages: [
      {
        role: "system",
        content:
          'Analyze this sales lead. Return JSON: { score: number (0-100), analysis: string, suggestedTags: string[] }',
      },
      {
        role: "user",
        content: JSON.stringify(params),
      },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0]?.message?.content ?? "{}");
}

export async function generateDailyReport(data: {
  clientsDue: number;
  newDeposits: number;
  depositValue: number;
  activeLeads: number;
  followUpNotes: string[];
}): Promise<string> {
  const openai = getOpenAI();
  if (!openai) {
    return `Daily Operations Report — ${new Date().toLocaleDateString()}\n\n• ${data.clientsDue} clients due for follow-up\n• ${data.newDeposits} new deposit(s) totaling $${data.depositValue.toLocaleString()}\n• ${data.activeLeads} active leads in pipeline\n\nPriority actions: Complete all due follow-ups and review high-value client accounts.`;
  }

  const response = await openai.chat.completions.create({
    model: getChatModel(),
    messages: [
      {
        role: "system",
        content:
          "Generate a concise daily operations report for the AXPM sales team. Use bullet points. Be actionable.",
      },
      { role: "user", content: JSON.stringify(data) },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}

function getMockSuggestions(channel: Channel): string[] {
  if (channel === "wechat") {
    return [
      "您好！感谢您对我们账户的关注。我可以为您安排一次简短的介绍通话吗？",
      "感谢您的耐心。我已准备好账户详情文件，请问您方便什么时候查看？",
      "如有任何问题，请随时联系我。期待与您进一步沟通！",
    ];
  }
  return [
    "Thank you for your interest! I'd be happy to schedule a quick call to walk you through our account options.",
    "I've prepared the account details for you. When would be a convenient time to review them?",
    "Please let me know if you have any questions. Looking forward to connecting with you!",
  ];
}
