import "server-only";

import { createMessage } from "@/lib/conversations/store";
import { listClients } from "@/lib/crm/store";
import { sendWeChatWorkToClient } from "@/lib/integrations/wechat-work";
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp";
import type { ConversationMessage } from "@/types/conversation";
import type { InboxSession } from "@/types/inbox";

export type DeliverResult =
  | {
      ok: true;
      message: ConversationMessage;
      channel: "wechat_work" | "whatsapp" | "web" | "local";
    }
  | { ok: false; error: string };

export async function deliverAgentReply(input: {
  session: InboxSession;
  content: string;
  senderLabel: string;
}): Promise<DeliverResult> {
  const { session, content, senderLabel } = input;
  if (!session.client_id) {
    return { ok: false, error: "Session has no linked client" };
  }

  const clients = await listClients();
  const client = clients.find((c) => c.id === session.client_id);
  if (!client) {
    return { ok: false, error: "Client not found" };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, error: "Message is empty" };
  }

  if (session.channel === "wechat") {
    const result = await sendWeChatWorkToClient({
      client_id: session.client_id,
      content: trimmed,
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, message: result.message, channel: "wechat_work" };
  }

  if (session.channel === "whatsapp") {
    const phone = client.whatsapp?.trim();
    if (!phone) {
      return {
        ok: false,
        error: "Client has no WhatsApp number — add it in Clients",
      };
    }
    const sent = await sendWhatsAppMessage(phone, trimmed);
    if (!sent) {
      return {
        ok: false,
        error: "WhatsApp send failed — check WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID",
      };
    }
    const message = await createMessage({
      client_id: client.id,
      client_name: client.name,
      channel: "whatsapp",
      direction: "outbound",
      sender_label: senderLabel,
      content: trimmed,
      source: "whatsapp",
    });
    return { ok: true, message, channel: "whatsapp" };
  }

  const message = await createMessage({
    client_id: client.id,
    client_name: client.name,
    wechat_id: session.wechat_id,
    channel: session.channel,
    direction: "outbound",
    sender_label: senderLabel,
    content: trimmed,
    source: session.channel === "web" ? "web_widget" : "manual",
  });

  return {
    ok: true,
    message,
    channel: session.channel === "web" ? "web" : "local",
  };
}
