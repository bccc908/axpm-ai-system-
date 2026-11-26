"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { CUSTOMER_LOGIN_PATH, STAFF_LOGIN_PATH, loginPathForSpace } from "@/lib/auth/login-space";
import { PUBLIC_BRAND, publicCopy } from "@/lib/brand/public-brand";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  const { locale, setLocale } = useLocale();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-start justify-between gap-3">
          <p className="text-sm font-semibold tracking-wide text-foreground">{PUBLIC_BRAND}</p>
          <div className="flex gap-1.5">
            <button type="button" className="rounded-lg border border-card-border px-3 py-1.5 text-xs" onClick={() => setLocale("zh")}>
              {locale === "zh" ? "中文" : "中文"}
            </button>
            <button type="button" className="rounded-lg border border-card-border px-3 py-1.5 text-xs" onClick={() => setLocale("en")}>
              EN
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function VerifyEmailForm() {
  const { locale, t } = useLocale();
  const copy = publicCopy(locale);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "bad">(token ? "working" : "idle");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "ok" : "bad");
      })
      .catch(() => {
        if (!cancelled) setStatus("bad");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNote(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setNote(res.ok ? copy.verifyResendOk : (data.error ?? copy.verifyInvalid));
    } catch {
      setNote(copy.verifyInvalid);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Frame title={copy.verifyTitle}>
      <p className="mt-2 text-sm text-muted">
        {status === "ok" ? copy.verifySuccess : status === "bad" ? copy.verifyInvalid : copy.verifySent}
      </p>
      {status === "working" ? <Loader2 className="mt-4 h-5 w-5 animate-spin text-accent" /> : null}
      {status === "ok" ? (
        <Link href={CUSTOMER_LOGIN_PATH as Route} className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          {copy.backToSignIn}
        </Link>
      ) : (
        <form className="mt-6 space-y-3" onSubmit={resend}>
          <label className="block text-xs text-muted" htmlFor="verify-email">
            {t("auth.email")}
          </label>
          <input
            id="verify-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
          />
          {note ? <p className="text-sm text-muted">{note}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {copy.verifyResend}
          </button>
        </form>
      )}
    </Frame>
  );
}

export function ForgotPasswordForm() {
  const { locale, t } = useLocale();
  const copy = publicCopy(locale);
  const searchParams = useSearchParams();
  const backHref = loginPathForSpace(searchParams.get("space") === "staff" ? "staff" : "customer");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNote(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setNote(res.ok ? copy.forgotOk : (data.error ?? copy.resetInvalid));
    } catch {
      setNote(copy.resetInvalid);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Frame title={copy.forgotTitle}>
      <p className="mt-2 text-sm text-muted">{copy.forgotDesc}</p>
      <form className="mt-6 space-y-3" onSubmit={submit}>
        <label className="block text-xs text-muted" htmlFor="forgot-email">
          {t("auth.email")}
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
        />
        {note ? <p className="text-sm text-muted">{note}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {copy.forgotSubmit}
        </button>
      </form>
      <Link href={backHref as Route} className="mt-6 inline-block text-sm text-accent hover:underline">
        {copy.backToSignIn}
      </Link>
    </Frame>
  );
}

export function ResetPasswordForm() {
  const { locale, t } = useLocale();
  const copy = publicCopy(locale);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [signInHref, setSignInHref] = useState(CUSTOMER_LOGIN_PATH);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNote(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { loginPath?: string };
      if (!res.ok) {
        setNote(copy.resetInvalid);
        return;
      }
      if (data.loginPath === STAFF_LOGIN_PATH || data.loginPath === CUSTOMER_LOGIN_PATH) {
        setSignInHref(data.loginPath);
      }
      setDone(true);
    } catch {
      setNote(copy.resetInvalid);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Frame title={copy.resetTitle}>
      {done ? (
        <>
          <p className="mt-2 text-sm text-muted">{copy.resetSuccess}</p>
          <Link href={signInHref as Route} className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
            {copy.backToSignIn}
          </Link>
        </>
      ) : (
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <label className="block text-xs text-muted" htmlFor="reset-password">
            {t("auth.password")}
          </label>
          <input
            id="reset-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
            autoComplete="new-password"
          />
          {note ? <p className="text-sm text-danger">{note}</p> : null}
          <button
            type="submit"
            disabled={submitting || !token}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {copy.resetSubmit}
          </button>
        </form>
      )}
    </Frame>
  );
}
