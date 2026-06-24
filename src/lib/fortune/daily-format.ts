/** Detect stale daily formats (anything not business brief). */

import { isBusinessDailyReading } from "@/lib/fortune/daily-business";

export { isBusinessDailyReading } from "@/lib/fortune/daily-business";

export function isLegacyDailyReading(reading: string): boolean {
  if (!reading?.trim()) return false;
  return !isBusinessDailyReading(reading);
}

export function normalizeDailyBody(text: string) {
  return text
    .replace(/20\d{2}年\d{1,2}月\d{1,2}日[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDuplicateDailyBody(a: string, b: string) {
  const na = normalizeDailyBody(a);
  const nb = normalizeDailyBody(b);
  if (na.length < 80 || nb.length < 80) return false;
  return na === nb;
}
