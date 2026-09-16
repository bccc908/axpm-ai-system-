import "server-only";

import { generateHlSignal } from "@/lib/hl-signals/signal-engine";
import {
  getHlSignalAutomation,
  hlTodayKey,
  saveHlSignalAutomation,
} from "@/lib/hl-signals/automation";
import { sendHlSignalTelegram } from "@/lib/hl-signals/telegram";

export async function runDailyHlSignal(options?: { force?: boolean }) {
  const automation = await getHlSignalAutomation();
  const today = hlTodayKey();

  if (!automation.daily_telegram_enabled && !options?.force) {
    return { ok: true as const, skipped: true, reason: "disabled" as const, today };
  }

  if (automation.last_daily_sent === today && !options?.force) {
    return {
      ok: true as const,
      skipped: true,
      reason: "already_sent" as const,
      today,
      last_daily_sent: automation.last_daily_sent,
    };
  }

  const dailyNotes =
    automation.daily_locale === "zh"
      ? "每日盘面信号：结合 Hyperliquid BTC-PERP 标记价、资金费率与订单流，给出今日永续交易计划。"
      : "Daily desk signal: Hyperliquid BTC-PERP plan from mark, funding and order flow.";

  const result = await generateHlSignal({
    locale: automation.daily_locale,
    timeframe: automation.daily_timeframe,
    notes: dailyNotes,
    includeNews: true,
  });

  if (!result.ok) {
    return { ok: false as const, skipped: false, error: result.error, today };
  }

  const telegram = await sendHlSignalTelegram(result.signal, { daily: true });
  if (!telegram.ok) {
    return {
      ok: true as const,
      skipped: false,
      partial: true as const,
      signal: result.signal,
      telegram,
      today,
    };
  }

  await saveHlSignalAutomation({ last_daily_sent: today });
  return {
    ok: true as const,
    skipped: false,
    signal: result.signal,
    telegram: { ok: true as const },
    today,
  };
}
