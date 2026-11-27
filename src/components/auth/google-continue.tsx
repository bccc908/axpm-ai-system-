"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useLocale } from "@/components/providers/locale-provider";
import { useCustomerGoogle } from "@/components/auth/auth-chrome";

type GoogleCodeClient = {
  requestCode: () => void;
};

type GoogleIdentity = {
  accounts?: {
    oauth2?: {
      initCodeClient: (config: {
        client_id: string;
        scope: string;
        ux_mode: "popup";
        callback: (response: { code?: string; error?: string }) => void;
      }) => GoogleCodeClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

function GoogleMark() {
  return (
    <svg className="g-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-gis='1']");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("gis")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.gis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis"));
    document.head.appendChild(script);
  });
}

export function GoogleContinue({ mode }: { mode: "signup" | "signin" }) {
  const { visible, clientId } = useCustomerGoogle();
  const { t } = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!visible || !clientId) return null;

  const label = mode === "signup" ? t("auth.googleContinue") : t("auth.googleSignIn");
  const id = clientId;

  async function finish(code: string | undefined, oauthError: string | undefined) {
    if (oauthError || !code) {
      setError(t("auth.googleUnavailable"));
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: { role?: string };
      };
      if (!res.ok) {
        setError(data.error ?? t("auth.googleUnavailable"));
        return;
      }
      const next = data.user?.role === "customer" ? "/dashboard/account" : "/dashboard";
      router.replace(next as Route);
    } catch {
      setError(t("auth.googleUnavailable"));
    } finally {
      setPending(false);
    }
  }

  async function start() {
    setError(null);
    try {
      await loadGoogleIdentity();
      const oauth = window.google?.accounts?.oauth2;
      if (!oauth) {
        setError(t("auth.googleUnavailable"));
        return;
      }
      const client = oauth.initCodeClient({
        client_id: id,
        scope: "openid email profile",
        ux_mode: "popup",
        callback: (response) => {
          void finish(response.code, response.error);
        },
      });
      client.requestCode();
    } catch {
      setError(t("auth.googleUnavailable"));
    }
  }

  return (
    <div className="google-alt">
      <button
        type="button"
        className="btn-google"
        data-testid="google-sign-in"
        onClick={() => void start()}
        disabled={pending}
      >
        <GoogleMark />
        <span>{label}</span>
      </button>
      {error ? <p className="auth-error">{error}</p> : null}
      <p className="auth-or">
        <span>{t("auth.or")}</span>
      </p>
    </div>
  );
}
