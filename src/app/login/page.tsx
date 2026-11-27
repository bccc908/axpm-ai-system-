"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { useDocumentTitle } from "@/components/layout/document-title";
import { LocaleProvider, useLocale } from "@/components/providers/locale-provider";
import type { Locale } from "@/lib/i18n";
import type { AuthModule, UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

function safeRedirectPath(raw: string | null): Route {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw as Route;
  }
  return "/dashboard";
}

function LoginLocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  const options: { value: Locale; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "zh", label: "中文" },
  ];
  return (
    <div className={cn("flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em]", className)}>
      {options.map((opt, index) => (
        <span key={opt.value} className="flex items-center gap-2">
          {index > 0 ? (
            <span className="text-muted/40" aria-hidden>
              /
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setLocale(opt.value)}
            className={cn(
              "uppercase",
              locale === opt.value ? "text-[#5BE7D4]" : "text-muted hover:text-[#8EF5E6]",
            )}
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

function LoginForm() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"));

  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          router.replace(next);
          return;
        }
        setSetupRequired(Boolean(data.setupRequired));
      })
      .finally(() => setLoading(false));
  }, [next, router]);

  const loginDocTitle = setupRequired ? t("auth.setupTitle") : t("docTitle.loginStaff");
  useDocumentTitle(`${loginDocTitle} · KD`);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = setupRequired ? "/api/auth/setup" : "/api/auth/login";
      const body = setupRequired ? { email, name, password } : { email, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("auth.failed"));
        return;
      }
      router.replace(next);
    } catch {
      setError(t("auth.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="premium-canvas flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#5BE7D4]" />
      </div>
    );
  }

  return (
    <main className="premium-canvas grid min-h-dvh grid-rows-[auto_1fr] bg-background md:grid-cols-[minmax(300px,5fr)_minmax(420px,6fr)] md:grid-rows-1">
      <section className="flex flex-col justify-center border-b border-card-border px-6 py-8 sm:px-10 md:border-b-0 md:border-r md:px-12 md:py-16 lg:px-16">
        <div className="flex items-center justify-between gap-4 md:hidden">
          <BrandLogo variant="auth" />
          <LoginLocaleToggle />
        </div>
        <div className="mt-6 h-0.5 w-10 bg-[#5BE7D4] md:mt-0" aria-hidden />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5BE7D4]">
          {t("auth.loginKicker")}
        </p>
        <p className="mt-2 max-w-[16rem] text-sm leading-6 text-foreground/90">{t("auth.secureNote")}</p>
      </section>

      <section className="relative flex items-start bg-surface px-6 pb-12 pt-8 sm:px-10 md:items-center md:px-14 md:py-10 lg:px-20">
        <div className="w-full max-w-[400px] md:mx-auto">
          <div className="mb-8 hidden items-center justify-between md:flex">
            <BrandLogo variant="auth" />
            <LoginLocaleToggle />
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">
            {setupRequired ? t("auth.setupTitle") : t("auth.loginTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {setupRequired ? t("auth.setupDesc") : t("auth.loginDesc")}
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {setupRequired ? (
              <div>
                <label htmlFor="login-name" className="mb-1.5 block text-xs font-medium text-muted">
                  {t("auth.name")}
                </label>
                <input
                  id="login-name"
                  className="input-premium w-full rounded-md px-3 py-2.5 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kayden"
                  required
                />
              </div>
            ) : null}
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-muted">
                {t("auth.email")}
              </label>
              <input
                id="login-email"
                type="email"
                className="input-premium w-full rounded-md px-3 py-2.5 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-muted">
                {t("auth.password")}
              </label>
              <input
                id="login-password"
                type="password"
                className="input-premium w-full rounded-md px-3 py-2.5 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={setupRequired ? 8 : 6}
                required
                autoComplete={setupRequired ? "new-password" : "current-password"}
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="auth-primary mt-2 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {setupRequired ? t("auth.setupBtn") : t("auth.loginBtn")}
            </button>
          </form>

          {!setupRequired ? (
            <p className="mt-8 border-t border-card-border pt-5 text-xs leading-5 text-muted">
              {t("auth.customerNote")}
              <a href="/signup" className="auth-link mt-1 block font-medium hover:underline">
                {t("auth.customerLink")}
              </a>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <LocaleProvider>
      <Suspense
        fallback={
          <div className="premium-canvas flex min-h-dvh items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-[#5BE7D4]" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </LocaleProvider>
  );
}

export type { AuthModule, UserRole };
