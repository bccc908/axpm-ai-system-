import "server-only";

import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { formatOkBrainMap } from "@/lib/market-signals/ok-brain-map";
import type { EthSignal } from "@/types/eth-signal";

function biasLabel(bias: EthSignal["bias"]) {
  const map = { long: "偏多 LONG", short: "偏空 SHORT", neutral: "震荡", wait: "观望" };
  return map[bias];
}

export function formatEthSignalTelegram(
  signal: EthSignal,
  opts?: { daily?: boolean },
): string {
  const entry =
    signal.entry_zone != null
      ? `${signal.entry_zone.low.toFixed(0)} – ${signal.entry_zone.high.toFixed(0)}`
      : "—";
  const targets = signal.take_profit.length
    ? signal.take_profit.map((p) => p.toFixed(0)).join(" / ")
    : "—";

  const header = opts?.daily
    ? ["<b>📅 每日以太坊信号 · Daily ETHUSD</b>", ""]
    : ["<b>Ξ ETHUSD 以太坊信号</b>", ""];

  return [
    ...header,
    `<b>${biasLabel(signal.bias)}</b> · 置信 ${signal.confidence}% · ${signal.timeframe}`,
    signal.spot_price != null ? `参考价: $${signal.spot_price.toFixed(0)}` : "",
    "",
    signal.thesis.slice(0, 600),
    "",
    `进场: ${entry}`,
    `止损: ${signal.stop_loss?.toFixed(0) ?? "—"}`,
    `目标: ${targets}`,
    `失效: ${signal.invalidation}`,
    "",
    "<b>订单流读法</b>",
    signal.bookmap_playbook.slice(0, 500),
    signal.ok_brain_map
      ? ["", "<b>0K脑图</b>", formatOkBrainMap(signal.ok_brain_map, "zh")].join("\n")
      : "",
    "",
    "<i>研究用途，非投资建议</i>",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendEthSignalTelegram(signal: EthSignal, opts?: { daily?: boolean }) {
  return sendTelegramMessage(formatEthSignalTelegram(signal, opts));
}
