import "server-only";
import { generateCustomerReply } from "@/lib/ai/customer-reply";
import { generateDeepSeekCustomerReply } from "@/lib/ai/deepseek-reply";
import { getLlmProvider } from "@/lib/ai/llm-config";
import { getReplyProvider, isOpenClawConfigured } from "@/lib/ai/openclaw-config";
import { getAgentTrainingBrief } from "@/lib/ai/agent-knowledge";
import { readAppSettings } from "@/lib/finance/settings";
import { listMessages } from "@/lib/conversations/store";
import { listClients } from "@/lib/crm/store";
import { storePendingReplyDraft } from "@/lib/support/draft-approval";
import type { Channel } from "@/types/database";

export type AutoReplyInput = {
  channel: Extract<Channel, "whatsapp" | "wechat">;
  clientId: string;
  clientName: string;
  customerQuestion: string;
  /** WhatsApp phone or WeChat external_userid */
  sendTarget: string;
};

export type AutoReplyResult = {
  sent: boolean;
  reply?: string;
  reason?: string;
  provider?: string;
  fallback?: boolean;
  draftId?: string;
};

export async function isAutoReplyEnabledForChannel(
  channel: AutoReplyInput["channel"],
) {
  const settings = await readAppSettings();
  if (settings.autoReplyEnabled !== true) return false;
  if (channel === "whatsapp") return settings.autoReplyWhatsApp !== false;
  if (channel === "wechat") return settings.autoReplyWeChat !== false;
  return false;
}

function formatHistory(messages: Awaited<ReturnType<typeof listMessages>>) {
  return messages
    .slice()
    .reverse()
    .map((m) => {
      const who = m.direction === "inbound" ? "Customer" : "Agent";
      return `${who}: ${m.content}`;
    })
    .join("\n");
}

export async function maybeAutoReply(
  input: AutoReplyInput,
): Promise<AutoReplyResult> {
  const enabled = await isAutoReplyEnabledForChannel(input.channel);
  if (!enabled) {
    return { sent: false, reason: "auto_reply_disabled" };
  }

  const clients = await listClients();
  const client = clients.find((c) => c.id === input.clientId);
  const historyMessages = await listMessages({
    client_id: input.clientId,
    channel: input.channel,
    limit: 12,
  });
  const conversationHistory = formatHistory(historyMessages);

  const trainingBrief = await getAgentTrainingBrief();
  const settings = await readAppSettings();
  const manualBrief = settings.replyAgentPrompt?.trim();
  const customBrief = [trainingBrief, manualBrief].filter(Boolean).join("\n\n");

  const llmProvider = getLlmProvider();
  const replyProvider = getReplyProvider();
  const preferOpenClaw =
    llmProvider !== "deepseek" &&
    (replyProvider === "openclaw" ||
      (replyProvider === "auto" && isOpenClawConfigured()));

  const replyInput = {
    channel: input.channel,
    clientName: input.clientName,
    customerQuestion: input.customerQuestion,
    conversationHistory: conversationHistory || undefined,
    clientNotes: client?.notes ?? undefined,
    customBrief: customBrief || undefined,
    tone: "professional" as const,
  };

  const result =
    llmProvider === "deepseek"
      ? await generateDeepSeekCustomerReply(replyInput)
      : preferOpenClaw
        ? await generateCustomerReply(replyInput)
        : await generateCustomerReply(replyInput);

  const reply = result.replies[0]?.trim();
  if (!reply) {
    return { sent: false, reason: "empty_reply", fallback: result.fallback };
  }

  // Approval gate: never send to the inbound WhatsApp/WeChat target.
  // sendTarget is accepted only so callers keep compiling; it is not used to deliver.
  void input.sendTarget;
  const draft = await storePendingReplyDraft({
    channel: input.channel,
    clientName: input.clientName,
    clientId: input.clientId,
    customerQuestion: input.customerQuestion,
    conversationHistory: conversationHistory || undefined,
    replies: result.replies,
    provider: result.fallback ? "fallback" : (result.provider ?? "ai"),
    fallback: Boolean(result.fallback),
    notice: "notice" in result && typeof result.notice === "string" ? result.notice : null,
    source: "auto_reply",
  });

  return {
    sent: false,
    reply,
    reason: "pending_approval",
    provider: result.fallback ? "fallback" : (result.provider ?? "ai"),
    fallback: result.fallback,
    draftId: draft?.id,
  };
}
