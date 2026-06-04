"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppBanner() {
  const { t } = useLocale();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed) return null;

  async function handleInstall() {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
      return;
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{t("app.installTitle")}</p>
        <p className="mt-0.5 text-xs text-muted">{t("app.installDesc")}</p>
        {!deferred && (
          <p className="mt-2 text-xs text-muted">{t("app.installIosHint")}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {deferred && (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-muted"
          >
            <Download className="h-3.5 w-3.5" />
            {t("app.installBtn")}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-card-border p-2 text-muted hover:text-foreground"
          aria-label={t("common.cancel")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
