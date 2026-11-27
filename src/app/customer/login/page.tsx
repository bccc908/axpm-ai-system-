"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { AuthCard, AuthLoading, useAuthDocumentTitle, useAuthLocaleQuery } from "@/components/auth/auth-chrome";
import { GoogleContinue } from "@/components/auth/google-continue";
import { useLocale } from "@/components/providers/locale-provider";

function safeRedirectPath(raw: string | null): Route {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw as Route;
  }
  return "/dashboard/account";
}

function CustomerLoginForm() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useAuthDocumentTitle("Sign in · KD", "登录 · KD");
  useAuthLocaleQuery();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) router.replace(next);
      })
      .catch(() => undefined);
  }, [next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("auth.failed"));
        return;
      }
      router.replace(data.user?.role === "customer" ? next : ("/dashboard" as Route));
    } catch {
      setError(t("auth.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      testId="customer-login"
      title={t("auth.customerLoginTitle")}
      description={t("auth.customerLoginDesc")}
      footer={
        <p className="auth-foot">
          {t("account.noAccount")}{" "}
          <Link href="/signup">{t("account.createAccount")}</Link>
        </p>
      }
    >
      <GoogleContinue mode="signin" />
      <form className="auth-form" onSubmit={handleSubmit}>
        <div>
          <label className="field-label" htmlFor="customer-email">
            {t("auth.email")}
          </label>
          <input
            id="customer-email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="customer-password">
            {t("auth.password")}
          </label>
          <input
            id="customer-password"
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete="current-password"
          />
        </div>
        <p className="card-forgot">
          <Link href="/forgot-password">{t("auth.forgotLink")}</Link>
        </p>
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" className="btn-accent" disabled={submitting}>
          {t("auth.loginBtn")}
        </button>
      </form>
    </AuthCard>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <CustomerLoginForm />
    </Suspense>
  );
}
