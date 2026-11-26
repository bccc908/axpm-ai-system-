"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { LocaleProvider, useLocale } from "@/components/providers/locale-provider";
import type { Locale } from "@/lib/i18n";
import { forgotPasswordPath, otherLoginPath, postLoginPath } from "@/lib/auth/login-space";
import type { LoginSpace } from "@/lib/auth/types";
import { PUBLIC_BRAND, publicCopy } from "@/lib/brand/public-brand";
import { cn } from "@/lib/utils";

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
              locale === opt.value ? "text-foreground" : "text-muted hover:text-foreground",
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

export function LoginCrossLinks({
  space,
  nextPath,
  note,
  otherLabel,
  signupLabel,
}: {
  space: LoginSpace;
  nextPath: string | null;
  note: string;
  otherLabel: string;
  signupLabel: string;
}) {
  return (
    <p className="mt-8 border-t border-card-border pt-5 text-xs leading-5 text-muted">
      {note}{" "}
      <a href={otherLoginPath(space, nextPath)} className="font-medium text-brand-teal hover:underline">
        {otherLabel}
      </a>
      <a href="/signup" className="mt-1 block font-medium text-brand-teal hover:underline">
        {signupLabel}
      </a>
    </p>
  );
}

export function LoginForm({ space }: { space: LoginSpace }) {
  const { t, locale } = useLocale();
  const copy = publicCopy(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const customer = space === "customer";

  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/me?space=${space}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          router.replace(postLoginPath(space, next) as Route);
          return;
        }
        if (space === "staff") setSetupRequired(Boolean(data.setupRequired));
      })
      .finally(() => setLoading(false));
  }, [next, router, space]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = setupRequired ? "/api/auth/setup" : customer ? "/api/auth/customer-login" : "/api/auth/login";
      const body = setupRequired ? { email, name, password } : { email, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "email_unverified") setError(copy.loginUnverified);
        else if (res.status === 401 || res.status === 400) setError(t("auth.invalidCredentials"));
        else setError(data.error ?? t("auth.failed"));
        return;
      }
      router.replace(postLoginPath(space, next) as Route);
    } catch {
      setError(t("auth.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="premium-canvas flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const title = setupRequired ? t("auth.setupTitle") : customer ? t("auth.customerLoginTitle") : t("auth.loginTitle");
  const description = setupRequired
    ? t("auth.setupDesc")
    : customer
      ? t("auth.customerLoginDesc")
      : t("auth.loginDesc");
  const kicker = customer ? t("auth.customerLoginKicker") : t("auth.loginKicker");
  const secureNote = customer ? t("auth.customerSecureNote") : t("auth.secureNote");

  return (
    <main
      data-login-space={space}
      className="premium-canvas grid min-h-dvh grid-rows-[auto_1fr] bg-background md:grid-cols-[minmax(300px,5fr)_minmax(420px,6fr)] md:grid-rows-1"
    >
      <section className="flex flex-col justify-center border-b border-card-border px-6 py-8 sm:px-10 md:border-b-0 md:border-r md:px-12 md:py-16 lg:px-16">
        <div className="flex items-start justify-between gap-4 md:block">
          <p className="text-lg font-semibold tracking-tight text-foreground md:text-2xl">{PUBLIC_BRAND}</p>
          <div className="pt-1 md:hidden">
            <LoginLocaleToggle />
          </div>
        </div>
        <div className="mt-6 h-0.5 w-10 bg-accent" aria-hidden />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">{kicker}</p>
        <p className="mt-2 max-w-[18rem] text-sm leading-6 text-foreground/90">{secureNote}</p>
      </section>

      <section className="relative flex items-start bg-surface px-6 pb-12 pt-8 sm:px-10 md:items-center md:px-14 md:py-10 lg:px-20">
        <div className="absolute right-6 top-6 hidden md:block lg:right-10 lg:top-8">
          <LoginLocaleToggle />
        </div>
        <div className="w-full max-w-[400px] md:mx-auto">
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>

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
            {!setupRequired ? (
              <p className="text-right text-xs">
                <a href={forgotPasswordPath(space)} className="font-medium text-brand-teal hover:underline">
                  {copy.forgotLink}
                </a>
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="btn-premium mt-2 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {setupRequired ? t("auth.setupBtn") : t("auth.loginBtn")}
            </button>
          </form>

          {!setupRequired ? (
            <LoginCrossLinks
              space={space}
              nextPath={next}
              note={customer ? t("auth.staffLoginNote") : t("auth.customerNote")}
              otherLabel={customer ? t("auth.staffLoginLink") : t("auth.customerLink")}
              signupLabel={t("auth.signupLink")}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function LoginScreen({ space }: { space: LoginSpace }) {
  return (
    <LocaleProvider storageKey="kc-locale">
      <LoginForm space={space} />
    </LocaleProvider>
  );
}
