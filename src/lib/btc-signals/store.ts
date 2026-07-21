import "server-only";

import { randomUUID } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { BtcSignal, BtcSignalStore } from "@/types/btc-signal";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "btc-signals.json");
const MAX_SIGNALS = 80;

async function ensureStore(): Promise<BtcSignalStore> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as BtcSignalStore;
    if (Array.isArray(parsed.signals)) return parsed;
  } catch {
    /* create below */
  }
  const empty: BtcSignalStore = { signals: [], updated_at: new Date().toISOString() };
  await writeFile(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
  return empty;
}

export async function listBtcSignals(limit = 20): Promise<BtcSignal[]> {
  const store = await ensureStore();
  return store.signals.slice(0, limit);
}

export async function getLatestBtcSignal(): Promise<BtcSignal | null> {
  const store = await ensureStore();
  return store.signals[0] ?? null;
}

export async function appendBtcSignal(
  signal: Omit<BtcSignal, "id" | "created_at">,
): Promise<BtcSignal> {
  const store = await ensureStore();
  const row: BtcSignal = {
    ...signal,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  store.signals = [row, ...store.signals].slice(0, MAX_SIGNALS);
  store.updated_at = row.created_at;
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return row;
}
