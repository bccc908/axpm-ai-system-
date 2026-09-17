import "server-only";

import { generateEthSignal } from "@/lib/eth-signals/signal-engine";
import { kettArmed, kettOpenEth } from "@/lib/hyperliquid/trading";
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

  const notes = `${auto.prompt.trim()}

执行规则：这是 Groktagon 自动交易指令，标的是 Hyperliquid ETH-PERP。bias 只能是 long/short/wait。没把握必须 wait。entry_zone 必须贴近当前标记价。禁止给已经远离现价的过期区间。`;

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
