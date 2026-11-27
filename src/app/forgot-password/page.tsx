"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard, AuthLoading, useAuthDocumentTitle, useAuthLocaleQuery } from "@/components/auth/auth-chrome";
import { useLocale } from "@/components/providers/locale-provider";

function ForgotPasswordForm() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("from") === "staff" ? "/login" : "/customer/login";
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useAuthDocumentTitle("Reset your password · KD", "重置密码 · KD");
  useAuthLocaleQuery();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setNote(t("auth.emailNotConnected"));
  }

  return (
    <AuthCard
      testId="forgot-password"
      title={t("auth.forgotTitle")}
      description={t("auth.forgotDesc")}
      footer={
        <Link href={backHref} className="link-accent block-link">
          {t("auth.backToSignIn")}
        </Link>
      }
    >
      <form className="auth-form tight" onSubmit={handleSubmit}>
        <div>
          <label className="field-label" htmlFor="forgot-email">
            {t("auth.email")}
          </label>
          <input
            id="forgot-email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>
        {note ? (
          <p className="auth-note" role="status">
            {note}
          </p>
        ) : null}
        <button type="submit" className="btn-accent">
          {t("auth.forgotSubmit")}
        </button>
      </form>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
