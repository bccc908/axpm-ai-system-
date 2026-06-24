/** Product display name — 信号旗 / Signal Flag */
export const BRAND = {
  zh: "信号旗",
  en: "Signal Flag",
  shortZh: "信号旗",
  shortEn: "Signal",
} as const;

export function brandName(locale: "zh" | "en") {
  return locale === "zh" ? BRAND.zh : BRAND.en;
}
