import { en } from "./locales/en";
import { zh } from "./locales/zh";
import type { Locale, TranslationDict } from "./types";

export type { Locale, TranslationDict };

const dictionaries: Record<Locale, TranslationDict> = { en, zh };

export function getDictionary(locale: Locale): TranslationDict {
  return dictionaries[locale] ?? dictionaries.en;
}

/** Resolve dot-path key e.g. "nav.overview" with optional {var} interpolation */
export function translate(
  dict: TranslationDict,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const parts = key.split(".");
  let value: unknown = dict;
  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export const LOCALE_STORAGE_KEY = "axpm-locale";
/** Public registration page — defaults to 中文 */
export const REGISTER_LOCALE_STORAGE_KEY = "axpm-register-locale";

export function formatDateLocalized(date: string | Date, locale: Locale) {
  const tag = locale === "zh" ? "zh-CN" : "en-US";
  return new Intl.DateTimeFormat(tag, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}
