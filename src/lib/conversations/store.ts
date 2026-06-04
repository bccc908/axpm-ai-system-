import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type {
  ConversationData,
  ConversationMessage,
  ConversationThread,
  MessageDirection,
  MessageSource,
} from "@/types/conversation";
import type { Channel } from "@/types/database";
import { parseWeChatPaste } from "./parse-wechat";
import { ensureClientFromContact } from "@/lib/crm/auto-client";

const DATA_FILE = path.join(process.cwd(), "data", "conversations.json");

async function ensureFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ messages: [] }, null, 2));
  }
}

async function readData(): Promise<ConversationData> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as ConversationData;
}

async function writeData(data: ConversationData) {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function listMessages(filters?: {
  client_id?: string;
  channel?: Channel;
  limit?: number;
}) {
  const data = await readData();
  let messages = [...data.messages].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
  );

  if (filters?.client_id) {
    messages = messages.filter((m) => m.client_id === filters.client_id);
  }
  if (filters?.channel) {
    messages = messages.filter((m) => m.channel === filters.channel);
  }
  if (filters?.limit) {
    messages = messages.slice(0, filters.limit);
  }

  return messages;
}

export async function createMessage(input: {
  client_id?: string | null;
  client_name?: string | null;
  wechat_id?: string | null;
  channel?: Channel;
  direction: MessageDirection;
  sender_label: string;
  content: string;
  source?: MessageSource;
  external_id?: string | null;
  sent_at?: string;
}) {
  let clientId = input.client_id ?? null;
  let clientName = input.client_name ?? null;
  const channel = input.channel ?? "wechat";

  if (!clientId && input.direction === "inbound") {
    const contactName = clientName ?? input.sender_label ?? "Unknown contact";
    const channelId =
      input.wechat_id ??
      (channel === "whatsapp" ? input.sender_label : null);
    const ensured = await ensureClientFromContact({
      name: contactName,
      channel,
      channelId,
      wechat: channel === "wechat" ? input.wechat_id : undefined,
      whatsapp: channel === "whatsapp" ? channelId ?? undefined : undefined,
      source: "conversation",
    });
    if (!ensured.skipped && ensured.client?.id) {
      clientId = ensured.client.id;
      clientName = ensured.client.name;
    }
  }

  const data = await readData();
  const now = new Date().toISOString();
  const message: ConversationMessage = {
    id: randomUUID(),
    client_id: clientId,
    client_name: clientName,
    wechat_id: input.wechat_id ?? null,
    channel,
    direction: input.direction,
    sender_label: input.sender_label,
    content: input.content.trim(),
    source: input.source ?? "manual",
    external_id: input.external_id ?? null,
    sent_at: input.sent_at ?? now,
    created_at: now,
  };

  if (!message.content) {
    throw new Error("Message content is empty");
  }

  data.messages.unshift(message);
  await writeData(data);
  return message;
}

export async function importWeChatPaste(input: {
  client_id: string;
  client_name: string;
  wechat_id?: string | null;
  paste: string;
  my_name?: string;
}) {
  const parsed = parseWeChatPaste(input.paste, {
    myName: input.my_name,
    clientName: input.client_name,
  });

  if (parsed.length === 0) {
    const single = await createMessage({
      client_id: input.client_id,
      client_name: input.client_name,
      wechat_id: input.wechat_id,
      channel: "wechat",
      direction: "inbound",
      sender_label: input.client_name,
      content: input.paste.trim(),
      source: "import",
    });
    return { imported: 1, messages: [single] };
  }

  const data = await readData();
  const now = new Date().toISOString();
  const messages: ConversationMessage[] = parsed.map((line) => ({
    id: randomUUID(),
    client_id: input.client_id,
    client_name: input.client_name,
    wechat_id: input.wechat_id ?? null,
    channel: "wechat" as const,
    direction: line.direction,
    sender_label: line.sender,
    content: line.content,
    source: "import" as const,
    external_id: null,
    sent_at: line.sent_at ?? now,
    created_at: now,
  }));

  data.messages.unshift(...messages.reverse());
  await writeData(data);
  return { imported: messages.length, messages };
}

export async function recordWeChatWorkMessage(input: {
  external_id: string;
  wechat_user_id: string;
  sender_label: string;
  content: string;
  direction: MessageDirection;
  sent_at?: string;
  client_id?: string | null;
  client_name?: string | null;
}) {
  const data = await readData();
  if (data.messages.some((m) => m.external_id === input.external_id)) {
    return { duplicate: true as const, message: null };
  }

  const message = await createMessage({
    client_id: input.client_id,
    client_name: input.client_name,
    wechat_id: input.wechat_user_id,
    channel: "wechat",
    direction: input.direction,
    sender_label: input.sender_label,
    content: input.content,
    source: "wechat_work",
    external_id: input.external_id,
    sent_at: input.sent_at,
  });

  return { duplicate: false as const, message };
}

export async function getThreads(): Promise<ConversationThread[]> {
  const data = await readData();
  const map = new Map<string, ConversationThread>();

  for (const msg of data.messages) {
    const key = msg.client_id ?? `wechat:${msg.wechat_id ?? msg.client_name ?? "unknown"}`;
    const name = msg.client_name ?? msg.sender_label;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        client_id: msg.client_id,
        client_name: name,
        wechat_id: msg.wechat_id,
        channel: msg.channel,
        message_count: 1,
        last_message_at: msg.sent_at,
        last_preview: msg.content.slice(0, 120),
      });
    } else {
      existing.message_count += 1;
      if (new Date(msg.sent_at) > new Date(existing.last_message_at)) {
        existing.last_message_at = msg.sent_at;
        existing.last_preview = msg.content.slice(0, 120);
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  );
}

export async function deleteMessage(id: string) {
  const data = await readData();
  const before = data.messages.length;
  data.messages = data.messages.filter((m) => m.id !== id);
  if (data.messages.length === before) return false;
  await writeData(data);
  return true;
}

export async function getClientConversationText(clientId: string) {
  const messages = await listMessages({ client_id: clientId, channel: "wechat" });
  return messages
    .slice()
    .reverse()
    .map((m) => `${m.sender_label}: ${m.content}`)
    .join("\n");
}
