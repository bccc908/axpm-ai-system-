import type { Locale } from "@/lib/i18n/types";

const CHINESE_REGIONS = new Set(["CN", "HK", "MO", "TW", "SG"]);

/** Prefer 中文 for China / Greater China IPs and zh Accept-Language. */
export function detectLocaleFromHeaders(headers: Headers): Locale {
  const country = headers.get("cf-ipcountry")?.toUpperCase();
  if (country && CHINESE_REGIONS.has(country)) return "zh";

  const acceptLang = headers.get("accept-language") ?? "";
  const primary = acceptLang.split(",")[0]?.trim().toLowerCase() ?? "";
  if (primary.startsWith("zh")) return "zh";

  return "en";
}

export function localeFromQueryParam(value: string | null | undefined): Locale | null {
  if (value === "zh" || value === "en") return value;
  return null;
}
