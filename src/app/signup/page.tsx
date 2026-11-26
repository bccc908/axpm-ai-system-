"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { CUSTOMER_LOGIN_PATH } from "@/lib/auth/login-space";
import { PUBLIC_BRAND } from "@/lib/brand/public-brand";
import { localeFromQueryParam, type Locale } from "@/lib/i18n";

function SignupForm() {
  const { t, locale, setLocale } = useLocale();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);

  useEffect(() => {
    const lang = localeFromQueryParam(searchParams.get("lang"));
    if (lang) setLocale(lang);
  }, [searchParams, setLocale]);

  useEffect(() => {
    if (!refCode) {
      setInvitedBy(null);
      return;
    }
    fetch(`/api/public/referral?ref=${encodeURIComponent(refCode)}`)
      .then((r) => r.json())
      .then((data) => setInvitedBy(data.valid ? data.name : null))
      .catch(() => setInvitedBy(null));
  }, [refCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          password,
          ref: refCode ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("account.signupFailed"));
        return;
      }
      setSent(true);
    } catch {
      setError(t("account.signupFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function LangButton({ code, label }: { code: Locale; label: string }) {
    return (
      <button
        type="button"
        onClick={() => setLocale(code)}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          locale === code
            ? "bg-accent text-accent-foreground"
            : "border border-card-border text-muted hover:text-foreground"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/10 p-6">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-start justify-between gap-3">
          <p className="text-sm font-semibold tracking-wide text-foreground">{PUBLIC_BRAND}</p>
          <div className="flex shrink-0 gap-1.5">
            <LangButton code="zh" label={t("lang.zh")} />
            <LangButton code="en" label={t("lang.en")} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t("account.signupTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("account.signupDesc")}</p>
        {invitedBy ? (
          <p className="mt-3 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-xs text-foreground">
            {t("account.signupInvitedBy", { name: invitedBy })}
          </p>
        ) : null}

        {sent ? (
          <div className="mt-6 space-y-3 text-sm leading-6 text-foreground">
            <p>
              {locale === "zh"
                ? "请查收确认邮件。确认邮箱之前无法登录。"
                : "Check your inbox for a confirmation link. You cannot sign in until you confirm."}
            </p>
            <Link href="/verify-email" className="inline-block font-medium text-accent hover:underline">
              {locale === "zh" ? "重新发送确认信" : "Resend confirmation"}
            </Link>
          </div>
        ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs text-muted">{t("auth.name")}</label>
            <input
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">{t("auth.email")}</label>
            <input
              type="email"
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">{t("auth.password")}</label>
            <input
              type="password"
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("account.signupBtn")}
          </button>
        </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          {t("account.haveAccount")}{" "}
          <Link href={CUSTOMER_LOGIN_PATH as Route} className="text-accent hover:underline">
            {t("account.signInLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
