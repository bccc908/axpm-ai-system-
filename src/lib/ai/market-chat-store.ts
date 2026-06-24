import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const DATA_FILE = path.join(process.cwd(), "data", "market-chat.json");
const MAX_MESSAGES = 120;

export type MarketChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
  fallback?: boolean;
  created_at: string;
};

type ChatStore = { messages: MarketChatMessage[] };

async function ensureStore(): Promise<ChatStore> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf-8")) as ChatStore;
  } catch {
    return { messages: [] };
  }
}

async function writeStore(store: ChatStore) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

export async function listMarketChatMessages() {
  const store = await ensureStore();
  return store.messages.slice(-MAX_MESSAGES);
}

export async function appendMarketChatMessages(
  entries: Omit<MarketChatMessage, "id" | "created_at">[],
) {
  const store = await ensureStore();
  const now = new Date().toISOString();
  for (const entry of entries) {
    store.messages.push({
      id: randomUUID(),
      created_at: now,
      ...entry,
    });
  }
  if (store.messages.length > MAX_MESSAGES) {
    store.messages = store.messages.slice(-MAX_MESSAGES);
  }
  await writeStore(store);
  return store.messages;
}

export async function clearMarketChatMessages() {
  await writeStore({ messages: [] });
}

export async function replaceMarketChatMessages(
  messages: Omit<MarketChatMessage, "id" | "created_at">[],
) {
  const now = new Date().toISOString();
  const trimmed = messages.slice(-MAX_MESSAGES).map((m) => ({
    id: randomUUID(),
    created_at: now,
    ...m,
  }));
  await writeStore({ messages: trimmed });
  return trimmed;
}
