import "server-only";

import { randomUUID } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { HlSignal, HlSignalStore } from "@/types/hl-signal";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "hl-signals.json");
const MAX_SIGNALS = 80;

async function ensureStore(): Promise<HlSignalStore> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as HlSignalStore;
    if (Array.isArray(parsed.signals)) return parsed;
  } catch {
    /* create below */
  }
  const empty: HlSignalStore = { signals: [], updated_at: new Date().toISOString() };
  await writeFile(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
  return empty;
}

export async function listHlSignals(limit = 20): Promise<HlSignal[]> {
  const store = await ensureStore();
  return store.signals.slice(0, limit);
}

export async function appendHlSignal(
  signal: Omit<HlSignal, "id" | "created_at">,
): Promise<HlSignal> {
  const store = await ensureStore();
  const row: HlSignal = {
    ...signal,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  store.signals = [row, ...store.signals].slice(0, MAX_SIGNALS);
  store.updated_at = row.created_at;
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return row;
}
