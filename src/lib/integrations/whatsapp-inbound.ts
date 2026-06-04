import { ensureClientFromContact } from "@/lib/crm/auto-client";
import { createMessage } from "@/lib/conversations/store";

type WaTextMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
  timestamp?: string;
};

type WaContact = {
  profile?: { name?: string };
  wa_id?: string;
};

export async function handleWhatsAppWebhook(body: unknown) {
  const payload = body as {
    entry?: {
      changes?: {
        value?: {
          messages?: WaTextMessage[];
          contacts?: WaContact[];
        };
      }[];
    }[];
  };

  const recorded: string[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;

      const contactName =
        value.contacts?.[0]?.profile?.name ??
        value.contacts?.[0]?.wa_id ??
        "WhatsApp contact";

      for (const msg of value.messages) {
        if (msg.type !== "text" || !msg.text?.body) continue;

        const phone = msg.from;
        const { client, created, skipped } = await ensureClientFromContact({
          name: contactName,
          channel: "whatsapp",
          channelId: phone,
          whatsapp: phone,
          source: "whatsapp",
        });

        if (skipped || !client?.id) {
          recorded.push(`skipped:${msg.id}`);
          continue;
        }

        await createMessage({
          client_id: client.id,
          client_name: client.name,
          channel: "whatsapp",
          direction: "inbound",
          sender_label: client.name,
          content: msg.text.body,
          source: "whatsapp",
          external_id: msg.id,
          sent_at: msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000).toISOString()
            : undefined,
        });

        const { maybeAutoReply } = await import("@/lib/ai/auto-reply");
        const auto = await maybeAutoReply({
          channel: "whatsapp",
          clientId: client.id,
          clientName: client.name,
          customerQuestion: msg.text.body,
          sendTarget: phone,
        });

        recorded.push(
          `${created ? "new" : "existing"}:${client.id}:${msg.id}${auto.sent ? ":auto" : ""}`,
        );
      }
    }
  }

  return { recorded, count: recorded.length };
}
