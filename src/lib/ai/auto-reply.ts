import "server-only";
import { generateCustomerReply } from "@/lib/ai/customer-reply";
import { generateDeepSeekCustomerReply } from "@/lib/ai/deepseek-reply";
import { getLlmProvider } from "@/lib/ai/llm-config";
import { getReplyProvider, isOpenClawConfigured } from "@/lib/ai/openclaw-config";
import { getAgentTrainingBrief } from "@/lib/ai/agent-knowledge";
import { readAppSettings } from "@/lib/finance/settings";
import { listMessages, createMessage } from "@/lib/conversations/store";
import { listClients } from "@/lib/crm/store";
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp";
import { sendWeChatWorkMessage } from "@/lib/integrations/wechat-work";
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

  if (input.channel === "whatsapp") {
    const ok = await sendWhatsAppMessage(input.sendTarget, reply);
    if (!ok) {
      return { sent: false, reason: "whatsapp_send_failed", reply };
    }
    await createMessage({
      client_id: input.clientId,
      client_name: input.clientName,
      channel: "whatsapp",
      direction: "outbound",
      sender_label: "Grok Trading自动回复",
      content: reply,
      source: "whatsapp",
    });
    return {
      sent: true,
      reply,
      provider: result.fallback ? "fallback" : "ai",
      fallback: result.fallback,
    };
  }

  const sendResult = await sendWeChatWorkMessage({
    external_userid: input.sendTarget,
    content: reply,
  });
  if (!sendResult.ok) {
    return { sent: false, reason: sendResult.error, reply };
  }

  await createMessage({
    client_id: input.clientId,
    client_name: input.clientName,
    wechat_id: input.sendTarget,
    channel: "wechat",
    direction: "outbound",
    sender_label: "Grok Trading自动回复",
    content: reply,
    source: "wechat_work",
    external_id: sendResult.msgid,
  });

  return {
    sent: true,
    reply,
    provider: result.fallback ? "fallback" : "ai",
    fallback: result.fallback,
  };
}
