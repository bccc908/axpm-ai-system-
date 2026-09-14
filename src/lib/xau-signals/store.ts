import "server-only";

import { randomUUID } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { XauSignal, XauSignalStore } from "@/types/xau-signal";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "xau-signals.json");
const MAX_SIGNALS = 80;

async function ensureStore(): Promise<XauSignalStore> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as XauSignalStore;
    if (Array.isArray(parsed.signals)) return parsed;
  } catch {
    /* create below */
  }
  const empty: XauSignalStore = { signals: [], updated_at: new Date().toISOString() };
  await writeFile(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
  return empty;
}

export async function listXauSignals(limit = 20): Promise<XauSignal[]> {
  const store = await ensureStore();
  return store.signals.slice(0, limit);
}

export async function getLatestXauSignal(): Promise<XauSignal | null> {
  const store = await ensureStore();
  return store.signals[0] ?? null;
}

export async function appendXauSignal(
  signal: Omit<XauSignal, "id" | "created_at">,
): Promise<XauSignal> {
  const store = await ensureStore();
  const row: XauSignal = {
    ...signal,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  store.signals = [row, ...store.signals].slice(0, MAX_SIGNALS);
  store.updated_at = row.created_at;
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return row;
}
