import "server-only";

import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { formatOkBrainMap } from "@/lib/market-signals/ok-brain-map";
import type { GoldSpreadSignal } from "@/types/gold-spread-signal";

function biasLabel(bias: GoldSpreadSignal["bias"]) {
  const map = { long: "偏多 LONG", short: "偏空 SHORT", neutral: "震荡", wait: "观望" };
  return map[bias];
}

export function formatGoldSpreadTelegram(
  signal: GoldSpreadSignal,
  opts?: { daily?: boolean },
): string {
  const s = signal.spread;
  const entry =
    signal.entry_zone != null
      ? `${signal.entry_zone.low.toFixed(2)} – ${signal.entry_zone.high.toFixed(2)}`
      : "—";
  const targets = signal.take_profit.length
    ? signal.take_profit.map((p) => p.toFixed(2)).join(" / ")
    : "—";
  const header = opts?.daily
    ? ["<b>📅 每日黄金价差 · XAUUSD vs XAUUSDT</b>", ""]
    : ["<b>⚖️ XAUUSD vs XAUUSDT 价差信号</b>", ""];

  return [
    ...header,
    `<b>${biasLabel(signal.bias)}</b> · 置信 ${signal.confidence}% · ${signal.timeframe}`,
    `XAUUSD: $${s.xauusd.toFixed(2)}（${s.xauusd_source}）`,
    `XAUUSDT: $${s.xauusdt.toFixed(2)}（${s.xauusdt_source}）`,
    `价差 USDT−USD: ${s.spread >= 0 ? "+" : ""}${s.spread.toFixed(2)}（${s.spread_pct}%）`,
    `领涨: ${s.leader}`,
    "",
    signal.thesis.slice(0, 600),
    "",
    `进场: ${entry}`,
    `止损: ${signal.stop_loss?.toFixed(2) ?? "—"}`,
    `目标: ${targets}`,
    `失效: ${signal.invalidation}`,
    "",
    "<b>价差读法</b>",
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

export async function sendGoldSpreadTelegram(signal: GoldSpreadSignal, opts?: { daily?: boolean }) {
  return sendTelegramMessage(formatGoldSpreadTelegram(signal, opts));
}
