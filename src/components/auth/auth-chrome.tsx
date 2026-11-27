"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/components/providers/locale-provider";
import { localeFromQueryParam } from "@/lib/i18n";
import { QuietSignalBackground } from "@/components/auth/quiet-signal-bg";
import { useAuthMarket, type AuthMarketValue } from "@/components/auth/auth-market";
import "./quiet-signal.css";

export function QuietSignalShell({
  market,
  children,
}: {
  market: AuthMarketValue["market"];
  children: React.ReactNode;
}) {
  return (
    <div className="auth-quiet" data-market={market} data-testid="auth-shell">
      <QuietSignalBackground />
      <div className="auth-quiet-content">{children}</div>
    </div>
  );
}

/** `?lang=` or `?locale=` sets this visit only. It does not overwrite the stored toggle. */
export function useAuthLocaleQuery() {
  const { setLocale } = useLocale();
  const searchParams = useSearchParams();
  useEffect(() => {
    const lang = localeFromQueryParam(searchParams.get("lang") ?? searchParams.get("locale"));
    if (lang) setLocale(lang, "query");
  }, [searchParams, setLocale]);
}

export function useAuthDocumentTitle(english: string, chinese: string) {
  const { locale } = useLocale();
  useEffect(() => {
    document.title = locale === "zh" ? chinese : english;
  }, [locale, english, chinese]);
}

export function LangPills() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="lang-pills" role="group" aria-label={t("lang.switch")}>
      <button
        type="button"
        className={locale === "zh" ? "lang-pill is-active" : "lang-pill"}
        onClick={() => setLocale("zh")}
        aria-pressed={locale === "zh"}
      >
        {t("lang.zh")}
      </button>
      <button
        type="button"
        className={locale === "en" ? "lang-pill is-active" : "lang-pill"}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        {t("lang.en")}
      </button>
    </div>
  );
}

export function StaffLangToggle() {
  const { locale, setLocale, t } = useLocale();
  const options = [
    { value: "en" as const, label: "EN" },
    { value: "zh" as const, label: "中文" },
  ];
  return (
    <div className="lang-text">
      {options.map((opt, index) => (
        <span key={opt.value} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          {index > 0 ? (
            <span className="lang-slash" aria-hidden="true">
              /
            </span>
          ) : null}
          <button
            type="button"
            className={locale === opt.value ? "is-active" : undefined}
            onClick={() => setLocale(opt.value)}
            aria-pressed={locale === opt.value}
            aria-label={t("lang.switch")}
          >
            {opt.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export function AuthCard({
  title,
  description,
  children,
  footer,
  testId,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testId?: string;
}) {
  return (
    <main className="shell-center" data-testid={testId}>
      <div className="auth-card">
        <div className="card-head">
          <p className="wordmark-card">KD</p>
          <LangPills />
        </div>
        <h1 className="auth-title">{title}</h1>
        {description ? <p className="auth-desc">{description}</p> : null}
        {children}
        {footer}
      </div>
    </main>
  );
}

export function AuthLoading() {
  return (
    <div className="auth-loading" role="status">
      <div className="auth-spinner" />
    </div>
  );
}

export function useCustomerGoogle() {
  const market = useAuthMarket();
  const visible = market.audience === "customer" && market.market !== "china" && Boolean(market.googleClientId);
  return { visible, clientId: visible ? market.googleClientId : null };
}
