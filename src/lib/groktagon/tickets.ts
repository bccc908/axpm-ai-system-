import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { GroktagonTicket, GroktagonTicketStatus } from "@/types/groktagon";
import { gateBtcTrade, MIN_CONFIDENCE } from "@/lib/groktagon/trade-gate";

const STORE_PATH = path.join(process.cwd(), "data", "groktagon-tickets.json");
const MAX_TICKETS = 40;

type Store = { tickets: GroktagonTicket[]; updated_at: string };

function normalize(row: GroktagonTicket): GroktagonTicket {
  return {
    ...row,
    expires_at: row.expires_at ?? null,
    entry_low: row.entry_low ?? null,
    entry_high: row.entry_high ?? null,
    stop_loss: row.stop_loss ?? null,
    take_profit: row.take_profit ?? null,
    block_reason: row.block_reason ?? null,
  };
}

function isFreshCandidate(row: GroktagonTicket) {
  if (row.confidence < MIN_CONFIDENCE) return false;
  if (row.bias !== "long" && row.bias !== "short") return false;
  const age = Date.now() - Date.parse(row.created_at);
  if (!Number.isFinite(age) || age > 6 * 3600_000) return false;
  if (row.expires_at) {
    const exp = Date.parse(row.expires_at);
    if (Number.isFinite(exp) && Date.now() > exp) return false;
  }
  if (row.source === "gold") return true;
  return row.entry_low != null && row.entry_high != null;
}

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (Array.isArray(parsed.tickets)) {
      return { ...parsed, tickets: parsed.tickets.map(normalize) };
    }
  } catch {
    /* create below */
  }
  return { tickets: [], updated_at: new Date().toISOString() };
}

async function writeStore(store: Store) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

export async function listGroktagonTickets(): Promise<GroktagonTicket[]> {
  const store = await readStore();
  return store.tickets;
}

export async function syncPendingTickets(candidates: GroktagonTicket[]): Promise<GroktagonTicket[]> {
  const store = await readStore();
  const known = new Set(store.tickets.map((t) => t.id));
  const pendingCount = store.tickets.filter((t) => t.status === "pending").length;
  let room = Math.max(0, 5 - pendingCount);
  for (const row of candidates.map(normalize)) {
    if (known.has(row.id) || room <= 0 || !isFreshCandidate(row)) continue;
    store.tickets.unshift({ ...row, status: "pending", decided_at: null });
    known.add(row.id);
    room -= 1;
  }
  store.tickets = store.tickets.slice(0, MAX_TICKETS);
  store.updated_at = new Date().toISOString();
  await writeStore(store);
  return store.tickets;
}

export async function holdDeadTickets(mark: number | null): Promise<GroktagonTicket[]> {
  const store = await readStore();
  let changed = false;
  const now = new Date().toISOString();
  for (const row of store.tickets) {
    if (row.status !== "pending") continue;
    if (row.source !== "btc" && row.source !== "hl") continue;
    const g = gateBtcTrade(row, mark ?? Number.NaN);
    if (!g.ok && g.dead) {
      row.status = "held";
      row.decided_at = now;
      row.block_reason = g.reason;
      changed = true;
    }
  }
  if (changed) {
    store.updated_at = now;
    await writeStore(store);
  }
  return store.tickets;
}

export async function decideGroktagonTicket(
  id: string,
  status: Exclude<GroktagonTicketStatus, "pending">,
): Promise<GroktagonTicket | null> {
  const store = await readStore();
  const row = store.tickets.find((t) => t.id === id);
  if (!row || row.status !== "pending") return null;
  row.status = status;
  row.decided_at = new Date().toISOString();
  store.updated_at = row.decided_at;
  await writeStore(store);
  return row;
}
