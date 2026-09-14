import "server-only";

import { randomUUID } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { GoldSpreadSignal, GoldSpreadStore } from "@/types/gold-spread-signal";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "gold-spread-signals.json");
const MAX_SIGNALS = 80;

async function ensureStore(): Promise<GoldSpreadStore> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as GoldSpreadStore;
    if (Array.isArray(parsed.signals)) return parsed;
  } catch {
    /* create below */
  }
  const empty: GoldSpreadStore = { signals: [], updated_at: new Date().toISOString() };
  await writeFile(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
  return empty;
}

export async function listGoldSpreadSignals(limit = 20): Promise<GoldSpreadSignal[]> {
  const store = await ensureStore();
  return store.signals.slice(0, limit);
}

export async function appendGoldSpreadSignal(
  signal: Omit<GoldSpreadSignal, "id" | "created_at">,
): Promise<GoldSpreadSignal> {
  const store = await ensureStore();
  const row: GoldSpreadSignal = {
    ...signal,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  store.signals = [row, ...store.signals].slice(0, MAX_SIGNALS);
  store.updated_at = row.created_at;
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return row;
}
