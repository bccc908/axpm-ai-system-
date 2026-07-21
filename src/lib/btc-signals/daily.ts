import "server-only";

import { generateBtcSignal } from "@/lib/btc-signals/signal-engine";
import {
  btcTodayKey,
  getBtcSignalAutomation,
  saveBtcSignalAutomation,
} from "@/lib/btc-signals/automation";
import { sendBtcSignalTelegram } from "@/lib/btc-signals/telegram";

export async function runDailyBtcSignal(options?: { force?: boolean }) {
  const automation = await getBtcSignalAutomation();
  const today = btcTodayKey();

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
      ? "每日盘面信号：结合当前比特币价格、宏观与订单流，给出今日 BTCUSD 交易计划。"
      : "Daily desk signal: BTCUSD plan from spot, macro context and order flow.";

  const result = await generateBtcSignal({
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

  const telegram = await sendBtcSignalTelegram(result.signal, { daily: true });

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

  await saveBtcSignalAutomation({ last_daily_sent: today });

  return {
    ok: true as const,
    skipped: false,
    signal: result.signal,
    telegram: { ok: true as const },
    today,
  };
}
