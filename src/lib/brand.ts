/** Product display name. */
export const BRAND = {
  zh: "Kayden Chiew",
  en: "Kayden Chiew",
  shortZh: "Kayden Chiew",
  shortEn: "Kayden Chiew",
} as const;

export function brandName(locale: "zh" | "en") {
  return locale === "zh" ? BRAND.zh : BRAND.en;
}
