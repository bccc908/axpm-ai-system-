export const FORTUNE_TIMEZONE = "Asia/Hong_Kong";

export function getFortuneTodayKey(date = new Date(), timezone = FORTUNE_TIMEZONE) {
  const override = process.env.FORTUNE_DATE_OVERRIDE?.trim();
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    return override;
  }
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Fixed morning moment for daily 起念问卦 (same hex all day). */
export const DAILY_HEXAGRAM_HOUR = 7;
export const DAILY_HEXAGRAM_MINUTE = 30;

export function getDailyHexagramMoment(dateKey?: string): Date {
  const key = dateKey ?? getFortuneTodayKey();
  const h = String(DAILY_HEXAGRAM_HOUR).padStart(2, "0");
  const m = String(DAILY_HEXAGRAM_MINUTE).padStart(2, "0");
  return new Date(`${key}T${h}:${m}:00+08:00`);
}

export function getFortuneTomorrowKey(from = new Date(), timezone = FORTUNE_TIMEZONE) {
  const hk = new Date(from.toLocaleString("en-US", { timeZone: timezone }));
  hk.setDate(hk.getDate() + 1);
  return hk.toLocaleDateString("en-CA", { timeZone: timezone });
}

export function getFortuneYesterdayKey(from = new Date(), timezone = FORTUNE_TIMEZONE) {
  const hk = new Date(from.toLocaleString("en-US", { timeZone: timezone }));
  hk.setDate(hk.getDate() - 1);
  return hk.toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Full label e.g. 2026年6月10日星期二 */
export function getFortuneDateLabel(locale: "en" | "zh", date = new Date()) {
  return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    timeZone: FORTUNE_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Short label e.g. 6月10日 */
export function getFortuneDateShort(locale: "en" | "zh", date = new Date()) {
  if (locale === "zh") {
    return date.toLocaleDateString("zh-CN", {
      timeZone: FORTUNE_TIMEZONE,
      month: "long",
      day: "numeric",
    });
  }
  return date.toLocaleDateString("en-US", {
    timeZone: FORTUNE_TIMEZONE,
    month: "short",
    day: "numeric",
  });
}

export function ensureDailyReadingDate<T extends { title: string; reading: string; summary: string | null }>(
  output: T,
  locale: "en" | "zh",
): T & { fortune_date: string } {
  const dateLabel = getFortuneDateLabel(locale);
  const dateKey = getFortuneTodayKey();
  const year = dateKey.slice(0, 4);

  let title = output.title;
  if (!title.includes(year) && !title.includes("月")) {
    title = `${dateLabel} · ${title}`;
  }

  let reading = output.reading;
  if (!reading.includes("今日日期") && !reading.includes(dateLabel)) {
    reading = `## 今日日期\n${dateLabel}\n\n${reading}`;
  }

  let summary = output.summary;
  if (summary && !summary.includes(year) && !summary.includes("【")) {
    summary = `【${dateLabel}】${summary}`;
  }

  return { ...output, title, reading, summary, fortune_date: dateKey };
}
