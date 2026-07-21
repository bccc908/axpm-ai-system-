import "server-only";

import { generateEthSignal } from "@/lib/eth-signals/signal-engine";
import {
  ethTodayKey,
  getEthSignalAutomation,
  saveEthSignalAutomation,
} from "@/lib/eth-signals/automation";
import { sendEthSignalTelegram } from "@/lib/eth-signals/telegram";

export async function runDailyEthSignal(options?: { force?: boolean }) {
  const automation = await getEthSignalAutomation();
  const today = ethTodayKey();

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
      ? "每日盘面信号：结合当前以太坊价格、宏观与订单流，给出今日 ETHUSD 交易计划。"
      : "Daily desk signal: ETHUSD plan from spot, macro context and order flow.";

  const result = await generateEthSignal({
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

  const telegram = await sendEthSignalTelegram(result.signal, { daily: true });

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

  await saveEthSignalAutomation({ last_daily_sent: today });

  return {
    ok: true as const,
    skipped: false,
    signal: result.signal,
    telegram: { ok: true as const },
    today,
  };
}
