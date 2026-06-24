import "server-only";

import { generateGoldSignal } from "@/lib/gold-signals/signal-engine";
import {
  getGoldSignalAutomation,
  goldTodayKey,
  saveGoldSignalAutomation,
} from "@/lib/gold-signals/automation";
import { sendGoldSignalTelegram } from "@/lib/gold-signals/telegram";

export async function runDailyGoldSignal(options?: { force?: boolean }) {
  const automation = await getGoldSignalAutomation();
  const today = goldTodayKey();

  if (!automation.daily_telegram_enabled && !options?.force) {
    return {
      ok: true as const,
      skipped: true,
      reason: "disabled" as const,
      today,
    };
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
      ? "每日盘面信号：结合当前金价、宏观与订单流，给出今日 XAUUSD 交易计划。"
      : "Daily desk signal: XAUUSD plan from spot, macro context and order flow.";

  const result = await generateGoldSignal({
    locale: automation.daily_locale,
    timeframe: automation.daily_timeframe,
    notes: dailyNotes,
    includeNews: true,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      skipped: false,
      error: result.error,
      today,
    };
  }

  const telegram = await sendGoldSignalTelegram(result.signal, { daily: true });

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

  await saveGoldSignalAutomation({ last_daily_sent: today });

  return {
    ok: true as const,
    skipped: false,
    signal: result.signal,
    telegram: { ok: true as const },
    today,
  };
}
