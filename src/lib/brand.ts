/** Product display name — AXPM */
export const BRAND = {
  zh: "AXPM",
  en: "AXPM",
  shortZh: "AXPM",
  shortEn: "AXPM",
} as const;

export function brandName(locale: "zh" | "en") {
  return locale === "zh" ? BRAND.zh : BRAND.en;
}
