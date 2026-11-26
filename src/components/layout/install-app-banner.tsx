"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import {
  detectPlatformHint,
  hintKeyFor,
  INSTALL_DISMISS_KEY,
  isDismissed,
  type PlatformHint,
} from "@/lib/pwa/install-prompt";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppBanner() {
  const { t } = useLocale();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [platformHint, setPlatformHint] = useState<PlatformHint>("generic");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = isDismissed(window.localStorage.getItem(INSTALL_DISMISS_KEY));
    } catch {
      /* private mode: show the banner */
    }
    setPlatformHint(detectPlatformHint(navigator.userAgent));
    setHidden(standalone || dismissed);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    setDeferred(null);
    if (choice?.outcome === "accepted") setHidden(true);
  }

  return (
    <div
      role="region"
      aria-label={t("app.installTitle")}
      className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-md border border-card-border bg-surface px-4 py-3"
      data-testid="install-app-banner"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("app.installTitle")}</p>
          <p className="mt-0.5 text-xs text-muted">{t("app.installDesc")}</p>
          {!deferred ? (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted">
              {platformHint === "ios" ? <Share className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              <span>{t(hintKeyFor(platformHint))}</span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {deferred ? (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:bg-accent-muted"
          >
            <Download className="h-3.5 w-3.5" />
            {t("app.installBtn")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center gap-1 rounded-lg border border-card-border px-2.5 py-2 text-xs text-muted hover:text-foreground"
          aria-label={t("app.installLater")}
        >
          <X className="h-3.5 w-3.5" />
          <span>{t("app.installLater")}</span>
        </button>
      </div>
    </div>
  );
}
