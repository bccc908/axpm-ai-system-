import "server-only";

import { generateEthSignal } from "@/lib/eth-signals/signal-engine";
import { listEthSignals } from "@/lib/eth-signals/store";
import { fetchHlEthQuote } from "@/lib/hyperliquid/price";
import { fetchEthDayRange, fetchHlBook } from "@/lib/hyperliquid/book";
import { kettArmed, kettOpenEth } from "@/lib/hyperliquid/trading";
import { buildEthQuotePlan } from "@/lib/groktagon/best-quote";
import { resolveLiveEthSetup } from "@/lib/groktagon/live-setup";
import {
  AUTOPILOT_INTERVAL_MS,
  getGroktagonAutopilot,
  saveGroktagonAutopilot,
} from "@/lib/groktagon/autopilot";

export type AutopilotRun = {
  ok: boolean;
  skipped: boolean;
  fired: boolean;
  reason: string;
};

const HOLD_WAIT_MS = 3 * 3600_000;

function ageMs(iso: string | null | undefined) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Date.now() - t : Number.POSITIVE_INFINITY;
}

function expired(iso: string | null | undefined) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() > t;
}

export async function runGroktagonAutopilot(options?: {
  force?: boolean;
}): Promise<AutopilotRun> {
  const auto = await getGroktagonAutopilot();
  if (!auto.enabled && !options?.force) {
    return { ok: true, skipped: true, fired: false, reason: "autopilot off" };
  }
  if (!kettArmed()) {
    const reason = "agent key missing · cannot auto-fire";
    await saveGroktagonAutopilot({ last_run_at: new Date().toISOString(), last_result: reason, last_fired: false });
    return { ok: false, skipped: false, fired: false, reason };
  }
  if (!options?.force && auto.last_run_at) {
    const elapsed = Date.now() - Date.parse(auto.last_run_at);
    if (Number.isFinite(elapsed) && elapsed < AUTOPILOT_INTERVAL_MS) {
      return { ok: true, skipped: true, fired: false, reason: "cooldown" };
    }
  }

  const setup = await resolveLiveEthSetup();
  if (setup.ok) {
    const result = await kettOpenEth(setup.side, {
      source: setup.source,
      confidence: setup.confidence,
      created_at: setup.created_at,
      expires_at: setup.expires_at,
      entry_low: setup.entry_low,
      entry_high: setup.entry_high,
      stop_loss: setup.stop_loss,
      take_profit: setup.take_profit,
    });
    const reason = result.ok ? result.detail : result.error;
    await saveGroktagonAutopilot({
      last_run_at: new Date().toISOString(),
      last_result: reason,
      last_fired: result.ok,
    });
    return { ok: result.ok, skipped: !result.ok, fired: result.ok, reason };
  }

  const [latest, quote, book, range] = await Promise.all([
    listEthSignals(1).then((rows) => rows[0] ?? null),
    fetchHlEthQuote().catch(() => null),
    fetchHlBook("ETH").catch(() => null),
    fetchEthDayRange().catch(() => null),
  ]);
  const plan = buildEthQuotePlan({
    book,
    mark: quote?.price ?? setup.mark,
    signal: latest,
    range,
    fireSide: null,
    fireReason: setup.reason,
  });

  const holdWait =
    !options?.force &&
    latest?.bias === "wait" &&
    !expired(latest.expires_at) &&
    ageMs(latest.created_at) < HOLD_WAIT_MS;

  if (holdWait) {
    const reason = `ETH wait ${latest.confidence}% · hold ${plan.best_price} · ${plan.best_time}`;
    await saveGroktagonAutopilot({
      last_run_at: new Date().toISOString(),
      last_result: reason,
      last_fired: false,
    });
    return { ok: true, skipped: true, fired: false, reason };
  }

  const notes = `${auto.prompt.trim()}

执行规则：Groktagon 自动交易，标的 Hyperliquid ETH-PERP。bias 只能是 long/short/wait。
现价买一 ${book?.bid ?? "—"} / 卖一 ${book?.ask ?? "—"}，标记 ${quote?.price ?? "—"}。
24h 区间 ${range ? `${range.low}–${range.high}` : "—"}。HOLT：${plan.best_price} · ${plan.best_time}。
现价若在 24h 中部：必须 wait，entry_zone 必须为 null。禁止把入场区画在现价旁边来迁就成交。
只有价格已经到达有 2R 的触发区时，才给 long/short，且 entry_zone 必须覆盖当前标记价。`;

  const generated = await generateEthSignal({
    locale: "zh",
    timeframe: "M15–H1",
    notes,
    includeNews: true,
  });
  if (!generated.ok) {
    const reason = generated.error;
    await saveGroktagonAutopilot({
      last_run_at: new Date().toISOString(),
      last_result: reason,
      last_fired: false,
    });
    return { ok: false, skipped: false, fired: false, reason };
  }

  const signal = generated.signal;
  if (signal.bias !== "long" && signal.bias !== "short") {
    const reason = `ETH ${signal.bias} ${signal.confidence}% · no auto open`;
    await saveGroktagonAutopilot({
      last_run_at: new Date().toISOString(),
      last_result: reason,
      last_fired: false,
    });
    return { ok: true, skipped: true, fired: false, reason };
  }

  const result = await kettOpenEth(signal.bias, {
    source: "eth",
    confidence: signal.confidence,
    created_at: signal.created_at,
    expires_at: signal.expires_at,
    entry_low: signal.entry_zone?.low ?? null,
    entry_high: signal.entry_zone?.high ?? null,
    stop_loss: signal.stop_loss,
    take_profit: signal.take_profit[0] ?? null,
  });
  const reason = result.ok ? result.detail : result.error;
  await saveGroktagonAutopilot({
    last_run_at: new Date().toISOString(),
    last_result: reason,
    last_fired: result.ok,
  });
  return { ok: result.ok, skipped: !result.ok, fired: result.ok, reason };
}
