/** Product display name — KD */
export const BRAND = {
  zh: "KD",
  en: "KD",
  shortZh: "KD",
  shortEn: "KD",
} as const;

export function brandName(locale: "zh" | "en") {
  return locale === "zh" ? BRAND.zh : BRAND.en;
}
