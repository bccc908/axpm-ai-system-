import type { Locale } from "@/lib/i18n/types";

/**
 * Country headers already set by the edge in front of this app.
 * Cloudflare first, then Vercel's equivalent. No extra geo vendor.
 */
const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country"] as const;

type HeaderSource = { get(name: string): string | null };

export function countryFromHeaders(headers: HeaderSource): string | null {
  for (const name of COUNTRY_HEADERS) {
    const raw = headers.get(name)?.trim().toUpperCase() ?? "";
    if (/^[A-Z]{2}$/.test(raw)) return raw;
  }
  return null;
}

/** Mainland China only. Other regions, including unknown, stay on the global path. */
export function isMainlandChina(country: string | null | undefined): boolean {
  return country?.trim().toUpperCase() === "CN";
}

export function localeFromCountry(country: string | null | undefined): Locale {
  return isMainlandChina(country) ? "zh" : "en";
}

/** CN → 中文. Every other country, and a missing header, → English. */
export function detectLocaleFromHeaders(headers: HeaderSource): Locale {
  return localeFromCountry(countryFromHeaders(headers));
}

export function localeFromQueryParam(value: string | null | undefined): Locale | null {
  if (value === "zh" || value === "en") return value;
  return null;
}

/**
 * A saved 中文 / English choice wins over a later IP country.
 * Empty or unknown storage falls through to the country default.
 */
export function resolveLocale(stored: string | null | undefined, detected: Locale): Locale {
  if (stored === "en" || stored === "zh") return stored;
  return detected;
}

/** Only the language toggle is written. A query locale is for this load and must not lock storage. */
export function storesLocaleChoice(source: "toggle" | "query"): boolean {
  return source === "toggle";
}
