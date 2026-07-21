import "server-only";

import { randomUUID } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { EthSignal, EthSignalStore } from "@/types/eth-signal";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "eth-signals.json");
const MAX_SIGNALS = 80;

async function ensureStore(): Promise<EthSignalStore> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as EthSignalStore;
    if (Array.isArray(parsed.signals)) return parsed;
  } catch {
    /* create below */
  }
  const empty: EthSignalStore = { signals: [], updated_at: new Date().toISOString() };
  await writeFile(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
  return empty;
}

export async function listEthSignals(limit = 20): Promise<EthSignal[]> {
  const store = await ensureStore();
  return store.signals.slice(0, limit);
}

export async function getLatestEthSignal(): Promise<EthSignal | null> {
  const store = await ensureStore();
  return store.signals[0] ?? null;
}

export async function appendEthSignal(
  signal: Omit<EthSignal, "id" | "created_at">,
): Promise<EthSignal> {
  const store = await ensureStore();
  const row: EthSignal = {
    ...signal,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  store.signals = [row, ...store.signals].slice(0, MAX_SIGNALS);
  store.updated_at = row.created_at;
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return row;
}
