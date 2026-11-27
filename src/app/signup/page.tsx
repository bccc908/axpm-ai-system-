"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { AuthCard, AuthLoading, useAuthDocumentTitle, useAuthLocaleQuery } from "@/components/auth/auth-chrome";
import { GoogleContinue } from "@/components/auth/google-continue";
import { useLocale } from "@/components/providers/locale-provider";

function SignupForm() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);

  useAuthDocumentTitle("Create account · KD", "注册账号 · KD");
  useAuthLocaleQuery();

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
      router.replace("/dashboard/account" as Route);
    } catch {
      setError(t("account.signupFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      testId="signup"
      title={t("account.signupTitle")}
      description={t("account.signupDesc")}
      footer={
        <p className="auth-foot">
          {t("account.haveAccount")}{" "}
          <Link href="/customer/login">{t("account.signInLink")}</Link>
        </p>
      }
    >
      {invitedBy ? <p className="auth-invite">{t("account.signupInvitedBy", { name: invitedBy })}</p> : null}
      <GoogleContinue mode="signup" />
      <form className="auth-form" onSubmit={handleSubmit}>
        <div>
          <label className="field-label" htmlFor="signup-name">
            {t("auth.name")}
          </label>
          <input
            id="signup-name"
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="signup-email">
            {t("auth.email")}
          </label>
          <input
            id="signup-email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="signup-password">
            {t("auth.password")}
          </label>
          <input
            id="signup-password"
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" className="btn-accent" disabled={submitting}>
          {t("account.signupBtn")}
        </button>
      </form>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <SignupForm />
    </Suspense>
  );
}
