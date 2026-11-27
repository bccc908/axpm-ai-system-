import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type CustomerMarketMode = "market" | "data" | "copy";

export type CustomerMarketMessage = {
  id: string;
  role: "user";
  content: string;
  mode: CustomerMarketMode;
  created_at: string;
};

type CustomerMarketFile = { messages: CustomerMarketMessage[] };

const MAX_MESSAGES = 80;

export function customerMarketDir(dir?: string) {
  return dir ?? path.join(process.cwd(), "data", "customer-market-chat");
}

export function staffMarketChatFile() {
  return path.join(process.cwd(), "data", "market-chat.json");
}

function safeUserId(userId: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(userId)) {
    throw new Error("Invalid customer id");
  }
  return userId;
}

export function customerMarketFile(userId: string, dir?: string) {
  return path.join(customerMarketDir(dir), `${safeUserId(userId)}.json`);
}

async function readFileStore(file: string): Promise<CustomerMarketFile> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf-8")) as CustomerMarketFile;
    return { messages: Array.isArray(parsed.messages) ? parsed.messages : [] };
  } catch {
    return { messages: [] };
  }
}

export async function listCustomerMarketMessages(userId: string, dir?: string) {
  const store = await readFileStore(customerMarketFile(userId, dir));
  return store.messages.slice(-MAX_MESSAGES);
}

export async function appendCustomerMarketPrompt(input: {
  userId: string;
  message: string;
  mode: CustomerMarketMode;
  dir?: string;
}) {
  const file = customerMarketFile(input.userId, input.dir);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const store = await readFileStore(file);
  const entry: CustomerMarketMessage = {
    id: randomUUID(),
    role: "user",
    content: input.message.trim(),
    mode: input.mode,
    created_at: new Date().toISOString(),
  };
  store.messages.push(entry);
  if (store.messages.length > MAX_MESSAGES) {
    store.messages = store.messages.slice(-MAX_MESSAGES);
  }
  await fs.writeFile(file, JSON.stringify(store, null, 2));
  return store.messages;
}
