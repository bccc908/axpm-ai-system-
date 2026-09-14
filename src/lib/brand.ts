/** Product display name — Grok Trading */
export const BRAND = {
  zh: "Grok Trading",
  en: "Grok Trading",
  shortZh: "Grok",
  shortEn: "Grok",
} as const;

export function brandName(locale: "zh" | "en") {
  return locale === "zh" ? BRAND.zh : BRAND.en;
}
