import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { SignalApproval, SignalEngine, WithApproval } from "./types";

type Row = { id: string; created_at?: string } & WithApproval & Record<string, unknown>;
type StoreFile = { signals: Row[]; updated_at: string };

function dataDir() {
  return path.join(process.cwd(), "data");
}

/** Same files the engine stores write: data/<engine>-signals.json */
export function signalStorePath(engine: SignalEngine) {
  return path.join(dataDir(), `${engine}-signals.json`);
}

// Serialise read-modify-write per file inside this process.
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => undefined));
  return next;
}

async function readStore(engine: SignalEngine): Promise<StoreFile> {
  try {
    const parsed = JSON.parse(await readFile(signalStorePath(engine), "utf8")) as StoreFile;
    if (Array.isArray(parsed.signals)) return parsed;
  } catch {
    /* missing or invalid */
  }
  return { signals: [], updated_at: new Date().toISOString() };
}

export async function getStoredSignal(engine: SignalEngine, id: string): Promise<Row | null> {
  const store = await readStore(engine);
  return store.signals.find((s) => s.id === id) ?? null;
}

/**
 * Update the approval block of one stored signal. Returns the new approval, or null when
 * the signal is not in the store.
 */
export function updateSignalApproval(
  engine: SignalEngine,
  id: string,
  update: (current: SignalApproval | undefined) => SignalApproval,
): Promise<SignalApproval | null> {
  const file = signalStorePath(engine);
  return withLock(file, async () => {
    const store = await readStore(engine);
    const row = store.signals.find((s) => s.id === id);
    if (!row) return null;
    row.approval = update(row.approval);
    await mkdir(dataDir(), { recursive: true });
    await writeFile(file, JSON.stringify(store, null, 2), "utf8");
    return row.approval;
  });
}

export function newPendingApproval(now = new Date().toISOString()): SignalApproval {
  return {
    status: "pending",
    requested_at: now,
    decided_at: null,
    decided_by: null,
    delivery: { channel: "telegram", message_id: null, sent_at: null, error: null },
  };
}

/** Only an explicitly approved signal may be exposed to anything outside the desk. */
export function isApproved(row: WithApproval | null | undefined) {
  return row?.approval?.status === "approved";
}
