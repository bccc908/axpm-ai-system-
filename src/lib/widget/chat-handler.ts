import "server-only";

import { randomUUID } from "crypto";
import { getAgentTrainingBrief } from "@/lib/ai/agent-knowledge";
import { generateDeepSeekCustomerReply } from "@/lib/ai/deepseek-reply";
import { generateCustomerReply } from "@/lib/ai/customer-reply";
import { getLlmProvider } from "@/lib/ai/llm-config";
import { readAppSettings } from "@/lib/finance/settings";
import { createMessage, listMessages } from "@/lib/conversations/store";
import { ensureWebVisitorClient, findWebVisitorBySession } from "@/lib/widget/web-visitor";
import { createActivity, ensureClientDeal } from "@/lib/crm/pro-store";

export type WidgetChatMessage = {
  role: "assistant" | "user";
  content: string;
  sentAt: string;
};

function formatHistory(messages: Awaited<ReturnType<typeof listMessages>>) {
  return [...messages]
    .reverse()
    .slice(-12)
    .map((m) => {
      const who = m.direction === "inbound" ? "Visitor" : "Agent";
      return `${who}: ${m.content}`;
    })
    .join("\n");
}

export async function getWidgetChatHistory(
  sessionId: string,
  since?: string,
): Promise<WidgetChatMessage[]> {
  const client = await findWebVisitorBySession(sessionId);
  if (!client) return [];

  const messages = await listMessages({ client_id: client.id, limit: 40 });
  const sinceMs = since ? new Date(since).getTime() : null;

  return [...messages]
    .reverse()
    .filter((m) => {
      if (!sinceMs) return true;
      return new Date(m.sent_at).getTime() > sinceMs;
    })
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.content,
      sentAt: m.sent_at,
    }));
}

export async function handlePublicWidgetChat(input: {
  sessionId: string;
  message: string;
  visitorName?: string;
  pageUrl?: string;
}) {
  const sessionId = input.sessionId.trim();
  const message = input.message.trim();
  if (!sessionId || !message) {
    throw new Error("sessionId and message are required");
  }

  const { client, created } = await ensureWebVisitorClient(sessionId, input.visitorName);
  const pageNote = input.pageUrl?.trim() ? `\nPage: ${input.pageUrl.trim()}` : "";

  if (created) {
    await ensureClientDeal(client.id, client.name, "website widget", true);
    await (await import("@/lib/crm/zoho-store")).ensureLeadFromInbound({
      name: input.visitorName?.trim() || client.name,
      email: client.email,
      source: "website widget",
      channel: "web",
      client_id: client.id,
      notes: pageNote || "Started live chat from website widget",
      autoAssign: true,
    });
    await createActivity({
      client_id: client.id,
      type: "web_chat",
      title: "New website visitor",
      body: pageNote || "Started live chat from website widget",
      channel: "web",
      actor_name: input.visitorName?.trim() || client.name,
      metadata: { sessionId, pageUrl: input.pageUrl ?? null },
    });
  }

  await createMessage({
    client_id: client.id,
    client_name: client.name,
    channel: "web",
    direction: "inbound",
    sender_label: input.visitorName?.trim() || client.name,
    content: message,
    source: "web_widget",
    external_id: randomUUID(),
  });

  const { notifyInboundMessageTelegram } = await import("@/lib/integrations/inbound-notify");
  await notifyInboundMessageTelegram({
    channel: "web_widget",
    clientName: input.visitorName?.trim() || client.name,
    clientId: client.id,
    preview: message,
    created,
  }).catch(() => undefined);

  await createActivity({
    client_id: client.id,
    type: "message",
    title: "Visitor message",
    body: message,
    channel: "web",
    actor_name: input.visitorName?.trim() || client.name,
    metadata: { direction: "inbound", sessionId },
  });

  const humanHandling = await (await import("@/lib/inbox/session-store")).isAiPausedForClient(client.id);
  if (humanHandling) {
    return {
      reply: "Thanks for your message. A team member will reply shortly.",
      sessionId,
      clientId: client.id,
      clientName: client.name,
      handoff: true,
      fallback: false,
      detectedLanguage: null,
    };
  }

  const historyMessages = await listMessages({ client_id: client.id, limit: 14 });
  const conversationHistory = formatHistory(historyMessages);
  const trainingBrief = await getAgentTrainingBrief();
  const settings = await readAppSettings();

  const replyInput = {
    channel: "web" as const,
    clientName: input.visitorName?.trim() || client.name,
    customerQuestion: message,
    conversationHistory: conversationHistory || undefined,
    clientNotes: [client.notes, pageNote].filter(Boolean).join("\n") || undefined,
    tone: "professional" as const,
    customBrief: trainingBrief || settings.replyAgentPrompt || undefined,
  };

  const result =
    getLlmProvider() === "deepseek"
      ? await generateDeepSeekCustomerReply(replyInput)
      : await generateCustomerReply(replyInput);

  const reply =
    result.replies[0]?.trim() ||
    "Thanks for your message. A team member will follow up shortly.";

  const sentAt = new Date().toISOString();
  await createMessage({
    client_id: client.id,
    client_name: client.name,
    channel: "web",
    direction: "outbound",
    sender_label: "Grok Trading助手",
    content: reply,
    source: "web_widget",
    external_id: randomUUID(),
    sent_at: sentAt,
  });

  await createActivity({
    client_id: client.id,
    type: "message",
    title: "AI reply sent",
    body: reply,
    channel: "web",
    actor_name: "Grok Trading助手",
    metadata: { direction: "outbound", fallback: Boolean(result.fallback) },
  });

  return {
    reply,
    sessionId,
    clientId: client.id,
    clientName: client.name,
    fallback: Boolean(result.fallback),
    detectedLanguage: result.detectedLanguage,
    sentAt,
    handoff: false,
  };
}

export async function countWebWidgetMessages() {
  const messages = await listMessages({ channel: "web", limit: 500 });
  const sessions = new Set(messages.map((m) => m.client_id).filter(Boolean));
  return {
    messageCount: messages.length,
    sessionCount: sessions.size,
  };
}
