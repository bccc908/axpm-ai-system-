import "server-only";

import { randomUUID } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { SignalRiskReview } from "@/lib/gold-signals/risk-review/types";
import type { AtasGoldAlert, BookmapGoldAlert, GoldSignal, GoldSignalStore, Mt5GoldAlert } from "@/types/gold-signal";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "gold-signals.json");
const MAX_SIGNALS = 80;

async function ensureStore(): Promise<GoldSignalStore> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as GoldSignalStore;
    if (Array.isArray(parsed.signals)) return parsed;
  } catch {
    /* create below */
  }
  const empty: GoldSignalStore = { signals: [], updated_at: new Date().toISOString() };
  await writeFile(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
  return empty;
}

export async function listGoldSignals(limit = 20): Promise<GoldSignal[]> {
  const store = await ensureStore();
  return store.signals.slice(0, limit);
}

export async function getLatestGoldSignal(): Promise<GoldSignal | null> {
  const store = await ensureStore();
  return store.signals[0] ?? null;
}

export async function appendGoldSignal(
  signal: Omit<GoldSignal, "id" | "created_at">,
): Promise<GoldSignal> {
  const store = await ensureStore();
  const row: GoldSignal = {
    ...signal,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  store.signals = [row, ...store.signals].slice(0, MAX_SIGNALS);
  store.updated_at = row.created_at;
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return row;
}

export async function getGoldSignalById(id: string): Promise<GoldSignal | null> {
  const store = await ensureStore();
  return store.signals.find((s) => s.id === id) ?? null;
}

/** Attach (or replace) the Risk Manager Review on a stored signal. */
export async function saveGoldSignalRiskReview(
  id: string,
  review: SignalRiskReview,
): Promise<boolean> {
  const store = await ensureStore();
  const idx = store.signals.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  store.signals[idx] = { ...store.signals[idx], risk_review: review };
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return true;
}

/**
 * Latest signal Kayden has APPROVED. Used by the public ATAS / Bookmap / MT5 bridges so a pending or
 * rejected signal never reaches a trading terminal.
 */
export async function getLatestApprovedGoldSignal(): Promise<GoldSignal | null> {
  const store = await ensureStore();
  return store.signals.find((s) => s.approval?.status === "approved") ?? null;
}

export function toAtasAlert(signal: GoldSignal): AtasGoldAlert {
  const entryMid =
    signal.entry_zone != null
      ? (signal.entry_zone.low + signal.entry_zone.high) / 2
      : signal.spot_price;

  const levels: AtasGoldAlert["levels"] = [];
  if (signal.entry_zone) {
    levels.push(
      { price: signal.entry_zone.low, label: "Entry low", kind: "entry_low" },
      { price: signal.entry_zone.high, label: "Entry high", kind: "entry_high" },
    );
  } else if (entryMid != null) {
    levels.push({ price: entryMid, label: "Entry", kind: "entry_low" });
  }
  if (signal.stop_loss != null) {
    levels.push({ price: signal.stop_loss, label: "Stop", kind: "stop" });
  }
  for (const [i, tp] of signal.take_profit.entries()) {
    levels.push({ price: tp, label: `TP${i + 1}`, kind: "target" });
  }
  const invNum = Number.parseFloat(signal.invalidation.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(invNum) && invNum > 1000) {
    levels.push({ price: invNum, label: "Invalidation", kind: "invalidation" });
  }

  return {
    symbol: signal.symbol,
    bias: signal.bias,
    strength: signal.strength,
    confidence: signal.confidence,
    spot: signal.spot_price,
    entry: entryMid,
    entry_zone: signal.entry_zone,
    stop: signal.stop_loss,
    targets: signal.take_profit,
    levels,
    alert: signal.thesis.split("\n")[0]?.slice(0, 160) ?? signal.thesis.slice(0, 160),
    playbook: signal.bookmap_playbook,
    cluster_triggers: signal.orderflow_triggers,
    invalidation: signal.invalidation,
    timeframe: signal.timeframe,
    updated_at: signal.created_at,
    signal_id: signal.id,
  };
}

export function toBookmapAlert(signal: GoldSignal): BookmapGoldAlert {
  const entryMid =
    signal.entry_zone != null
      ? (signal.entry_zone.low + signal.entry_zone.high) / 2
      : signal.spot_price;

  return {
    symbol: signal.symbol,
    bias: signal.bias,
    strength: signal.strength,
    confidence: signal.confidence,
    spot: signal.spot_price,
    entry: entryMid,
    stop: signal.stop_loss,
    targets: signal.take_profit,
    alert: signal.thesis.split("\n")[0]?.slice(0, 160) ?? signal.thesis.slice(0, 160),
    playbook: signal.bookmap_playbook,
    invalidation: signal.invalidation,
    timeframe: signal.timeframe,
    updated_at: signal.created_at,
    signal_id: signal.id,
  };
}

export function toMt5Alert(signal: GoldSignal): Mt5GoldAlert {
  const base = toAtasAlert(signal);
  return {
    ...base,
    mt5_symbols: ["XAUUSD", "XAUUSDm", "GOLD", "GC"],
    magic_number: 20260617,
    order_comment: `SF-${signal.bias}-${signal.id.slice(0, 8)}`,
    suggested_lots: signal.strength === "strong" ? 0.05 : signal.strength === "moderate" ? 0.02 : 0.01,
  };
}
