"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getDictionary,
  LOCALE_STORAGE_KEY,
  translate,
  type Locale,
} from "@/lib/i18n";
import type { TranslationDict } from "@/lib/i18n/types";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dict: TranslationDict;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  defaultLocale = "en",
  storageKey = LOCALE_STORAGE_KEY,
}: {
  children: React.ReactNode;
  /** Used when no locale is saved in localStorage (e.g. public register → zh) */
  defaultLocale?: Locale;
  /** Separate key so /register can default to 中文 without affecting dashboard */
  storageKey?: string;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Locale | null;
    if (stored === "en" || stored === "zh") {
      setLocaleState(stored);
    } else {
      setLocaleState(defaultLocale);
    }
  }, [defaultLocale, storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale, storageKey]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const dict = useMemo(() => getDictionary(locale), [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(dict, key, vars),
    [dict],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, dict }),
    [locale, setLocale, t, dict],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
