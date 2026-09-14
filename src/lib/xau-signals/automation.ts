import "server-only";

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const AUTO_PATH = path.join(DATA_DIR, "xau-signals-automation.json");

export interface XauSignalAutomation {
  daily_telegram_enabled: boolean;
  last_daily_sent: string | null;
  daily_locale: "zh" | "en";
  daily_timeframe: string;
  updated_at: string;
}

const TIMEZONE = process.env.XAU_DAILY_TIMEZONE?.trim() || "Asia/Hong_Kong";

export function xauTodayKey(timezone = TIMEZONE) {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

function envDailyEnabled(): boolean {
  const v = process.env.XAU_DAILY_TELEGRAM?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (v === "1" || v === "true" || v === "on") return true;
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

function defaultAutomation(): XauSignalAutomation {
  const locale = process.env.XAU_DAILY_LOCALE?.trim() === "en" ? "en" : "zh";
  return {
    daily_telegram_enabled: envDailyEnabled(),
    last_daily_sent: null,
    daily_locale: locale,
    daily_timeframe: process.env.XAU_DAILY_TIMEFRAME?.trim() || "M15–H1",
    updated_at: new Date().toISOString(),
  };
}

export async function getXauSignalAutomation(): Promise<XauSignalAutomation> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(AUTO_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<XauSignalAutomation>;
    const base = defaultAutomation();
    return {
      daily_telegram_enabled:
        typeof parsed.daily_telegram_enabled === "boolean"
          ? parsed.daily_telegram_enabled
          : base.daily_telegram_enabled,
      last_daily_sent: parsed.last_daily_sent ?? null,
      daily_locale: parsed.daily_locale === "en" ? "en" : "zh",
      daily_timeframe: parsed.daily_timeframe?.trim() || base.daily_timeframe,
      updated_at: parsed.updated_at ?? base.updated_at,
    };
  } catch {
    const fresh = defaultAutomation();
    await writeFile(AUTO_PATH, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

export async function saveXauSignalAutomation(
  patch: Partial<XauSignalAutomation>,
): Promise<XauSignalAutomation> {
  const current = await getXauSignalAutomation();
  const next: XauSignalAutomation = {
    ...current,
    ...patch,
    daily_locale: patch.daily_locale === "en" ? "en" : patch.daily_locale === "zh" ? "zh" : current.daily_locale,
    updated_at: new Date().toISOString(),
  };
  await writeFile(AUTO_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}
