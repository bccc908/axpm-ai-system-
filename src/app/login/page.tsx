"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Loader2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LocaleProvider, useLocale } from "@/components/providers/locale-provider";
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
      <div className="premium-canvas flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <main className="premium-canvas flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center p-6">
      <div className="glass-panel w-full max-w-[400px] rounded-lg p-7 md:p-8">
        <BrandLogo height={26} className="mb-6" />
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          {setupRequired ? t("auth.setupTitle") : t("auth.loginTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {setupRequired ? t("auth.setupDesc") : t("auth.loginDesc")}
        </p>

        <form className="mt-6 space-y-4 border-t border-card-border pt-6" onSubmit={handleSubmit}>
          {setupRequired ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">{t("auth.name")}</label>
              <input
                className="input-premium w-full rounded-md px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kayden"
                required
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("auth.email")}</label>
            <input
              type="email"
              className="input-premium w-full rounded-md px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("auth.password")}</label>
            <input
              type="password"
              className="input-premium w-full rounded-md px-3 py-2 text-sm"
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
            className="btn-premium flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {setupRequired ? t("auth.setupBtn") : t("auth.loginBtn")}
          </button>
        </form>

        {!setupRequired ? (
          <p className="mt-6 text-center text-xs text-muted">
            {t("account.noAccount")}{" "}
            <a href="/signup" className="text-accent hover:underline">
              {t("account.signupBtn")}
            </a>
          </p>
        ) : null}

        <p className="mt-6 flex items-center justify-center gap-1.5 border-t border-card-border pt-4 text-[11px] text-muted">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {t("auth.secureNote")}
        </p>
      </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <LocaleProvider>
      <Suspense
        fallback={
          <div className="premium-canvas flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </LocaleProvider>
  );
}

export type { AuthModule, UserRole };
