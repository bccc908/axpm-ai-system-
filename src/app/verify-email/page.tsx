"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard, AuthLoading, useAuthDocumentTitle, useAuthLocaleQuery } from "@/components/auth/auth-chrome";
import { useLocale } from "@/components/providers/locale-provider";

function VerifyEmailForm() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [note, setNote] = useState<string | null>(null);

  useAuthDocumentTitle("Verify your email · KD", "验证邮箱 · KD");
  useAuthLocaleQuery();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setNote(t("auth.emailNotConnected"));
  }

  return (
    <AuthCard testId="verify-email" title={t("auth.verifyTitle")} description={t("auth.verifyDesc")}>
      <form className="auth-form tight" onSubmit={handleSubmit}>
        <div>
          <label className="field-label" htmlFor="verify-email">
            {t("auth.email")}
          </label>
          <input
            id="verify-email"
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
          {t("auth.verifyResend")}
        </button>
      </form>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
