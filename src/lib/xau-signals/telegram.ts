import "server-only";

import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { formatOkBrainMap } from "@/lib/market-signals/ok-brain-map";
import type { XauSignal } from "@/types/xau-signal";

function biasLabel(bias: XauSignal["bias"]) {
  const map = { long: "偏多 LONG", short: "偏空 SHORT", neutral: "震荡", wait: "观望" };
  return map[bias];
}

export function formatXauSignalTelegram(
  signal: XauSignal,
  opts?: { daily?: boolean },
): string {
  const entry =
    signal.entry_zone != null
      ? `${signal.entry_zone.low.toFixed(2)} – ${signal.entry_zone.high.toFixed(2)}`
      : "—";
  const targets = signal.take_profit.length
    ? signal.take_profit.map((p) => p.toFixed(2)).join(" / ")
    : "—";

  const header = opts?.daily
    ? ["<b>📅 每日黄金信号 · Daily XAUUSDT</b>", ""]
    : ["<b>🥇 XAUUSDT 黄金信号</b>", ""];

  return [
    ...header,
    `<b>${biasLabel(signal.bias)}</b> · 置信 ${signal.confidence}% · ${signal.timeframe}`,
    signal.spot_price != null ? `参考价: $${signal.spot_price.toFixed(2)}` : "",
    "",
    signal.thesis.slice(0, 600),
    "",
    `进场: ${entry}`,
    `止损: ${signal.stop_loss?.toFixed(2) ?? "—"}`,
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

export async function sendXauSignalTelegram(signal: XauSignal, opts?: { daily?: boolean }) {
  return sendTelegramMessage(formatXauSignalTelegram(signal, opts));
}
