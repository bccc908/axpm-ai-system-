import "server-only";

import { sendTelegramMessage } from "@/lib/integrations/telegram";
import type { GoldSignal } from "@/types/gold-signal";

function biasLabel(bias: GoldSignal["bias"]) {
  const map = { long: "偏多 LONG", short: "偏空 SHORT", neutral: "震荡", wait: "观望" };
  return map[bias];
}

export function formatGoldSignalTelegram(
  signal: GoldSignal,
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
    ? ["<b>📅 每日黄金信号 · Daily XAUUSD</b>", ""]
    : ["<b>🥇 XAUUSD 黄金信号</b>", ""];

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
    "<b>ATAS 读法</b>",
    signal.bookmap_playbook.slice(0, 500),
    "",
    "<i>研究用途，非投资建议</i>",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendGoldSignalTelegram(signal: GoldSignal, opts?: { daily?: boolean }) {
  return sendTelegramMessage(formatGoldSignalTelegram(signal, opts));
}
