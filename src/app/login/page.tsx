"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { AuthLoading, StaffLangToggle, useAuthDocumentTitle, useAuthLocaleQuery } from "@/components/auth/auth-chrome";
import { useLocale } from "@/components/providers/locale-provider";
import type { AuthModule, UserRole } from "@/lib/auth/types";

function safeRedirectPath(raw: string | null): Route {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw as Route;
  }
  return "/dashboard";
}

function LoginForm() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"));

  const [setupRequired, setSetupRequired] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useAuthDocumentTitle("Staff sign in · KD", "员工登录 · KD");
  useAuthLocaleQuery();

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
      .catch(() => undefined);
  }, [next, router]);

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

  return (
    <main className="shell-login" data-testid="staff-login">
      <section className="login-brand">
        <div className="login-brand-top">
          <p className="wordmark-login">KD</p>
          <div className="login-lang-mobile">
            <StaffLangToggle />
          </div>
        </div>
        <div className="login-rule" aria-hidden="true" />
        <p className="login-kicker">{t("auth.loginKicker")}</p>
        <p className="login-note">{t("auth.secureNote")}</p>
      </section>

      <section className="login-panel">
        <div className="login-lang-desktop">
          <StaffLangToggle />
        </div>
        <div className="login-inner">
          <h1 className="login-title">{setupRequired ? t("auth.setupTitle") : t("auth.loginTitle")}</h1>
          <p className="login-desc">{setupRequired ? t("auth.setupDesc") : t("auth.loginDesc")}</p>

          <form className="login-form" onSubmit={handleSubmit}>
            {setupRequired ? (
              <div>
                <label htmlFor="login-name" className="field-label">
                  {t("auth.name")}
                </label>
                <input
                  id="login-name"
                  className="input-premium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div>
              <label htmlFor="login-email" className="field-label">
                {t("auth.email")}
              </label>
              <input
                id="login-email"
                type="email"
                className="input-premium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="field-label">
                {t("auth.password")}
              </label>
              <input
                id="login-password"
                type="password"
                className="input-premium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={setupRequired ? 8 : 6}
                required
                autoComplete={setupRequired ? "new-password" : "current-password"}
              />
            </div>
            {!setupRequired ? (
              <p className="login-forgot">
                <Link href="/forgot-password?from=staff">{t("auth.forgotLink")}</Link>
              </p>
            ) : null}
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="btn-premium" disabled={submitting}>
              {setupRequired ? t("auth.setupBtn") : t("auth.loginBtn")}
            </button>
          </form>

          {!setupRequired ? (
            <p className="login-customer">
              {t("auth.customerNote")}
              <Link href="/signup" className="link-teal">
                {t("auth.customerLink")}
              </Link>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <LoginForm />
    </Suspense>
  );
}

export type { AuthModule, UserRole };
