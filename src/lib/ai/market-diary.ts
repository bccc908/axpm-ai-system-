import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const DATA_FILE = path.join(process.cwd(), "data", "market-diary.json");
const MAX_ENTRIES = 2000;

export type MarketDiaryMode = "market" | "data" | "copy" | "ppt" | "image";

export type MarketDiaryEntry = {
  id: string;
  question: string;
  answer: string;
  mode: MarketDiaryMode;
  fallback?: boolean;
  created_at: string;
};

type DiaryStore = { entries: MarketDiaryEntry[] };

async function ensureStore(): Promise<DiaryStore> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf-8")) as DiaryStore;
  } catch {
    return { entries: [] };
  }
}

async function writeStore(store: DiaryStore) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

export async function appendMarketDiaryEntry(
  entry: Omit<MarketDiaryEntry, "id" | "created_at">,
) {
  const store = await ensureStore();
  const row: MarketDiaryEntry = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...entry,
  };
  store.entries.unshift(row);
  if (store.entries.length > MAX_ENTRIES) {
    store.entries = store.entries.slice(0, MAX_ENTRIES);
  }
  await writeStore(store);
  return row;
}

export async function listMarketDiaryEntries(limit = 200) {
  await migrateChatHistoryToDiaryIfEmpty();
  const store = await ensureStore();
  return store.entries.slice(0, limit);
}

/** One-time: copy existing chat log into diary so older questions appear */
async function migrateChatHistoryToDiaryIfEmpty() {
  const store = await ensureStore();
  if (store.entries.length > 0) return;

  const chatFile = path.join(process.cwd(), "data", "market-chat.json");
  try {
    const raw = await fs.readFile(chatFile, "utf-8");
    const chat = JSON.parse(raw) as {
      messages?: {
        role: string;
        content: string;
        mode?: string;
        fallback?: boolean;
        created_at?: string;
      }[];
    };
    const msgs = chat.messages ?? [];
    for (let i = 0; i < msgs.length - 1; i++) {
      const user = msgs[i];
      const assistant = msgs[i + 1];
      if (user.role !== "user" || assistant.role !== "assistant") continue;
      store.entries.unshift({
        id: randomUUID(),
        question: user.content,
        answer: assistant.content,
        mode: (user.mode as MarketDiaryMode) ?? "market",
        fallback: assistant.fallback,
        created_at: user.created_at ?? new Date().toISOString(),
      });
      i += 1;
    }
    if (store.entries.length > 0) {
      await writeStore(store);
    }
  } catch {
    /* no chat file yet */
  }
}

export function groupDiaryByDate(entries: MarketDiaryEntry[]) {
  const groups = new Map<string, MarketDiaryEntry[]>();
  for (const entry of entries) {
    const dateKey = entry.created_at.slice(0, 10);
    const list = groups.get(dateKey) ?? [];
    list.push(entry);
    groups.set(dateKey, list);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: items.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    }));
}

export async function deleteMarketDiaryEntry(id: string) {
  const store = await ensureStore();
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => e.id !== id);
  if (store.entries.length === before) return false;
  await writeStore(store);
  return true;
}
