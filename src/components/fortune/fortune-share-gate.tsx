"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Share2, SkipForward } from "lucide-react";
import {
  FORTUNE_SHARE_PLATFORMS,
  type FortuneSharePlatformId,
  fortunePlatformShareAction,
} from "@/lib/fortune/share-platforms";

type SharePayload = {
  url: string;
  viewUrl?: string | null;
  signupUrl?: string;
  text: string;
  title: string;
};

const platformBtn =
  "inline-flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[10px] font-medium text-foreground transition hover:border-accent/35 hover:bg-accent/5";

export function FortuneShareGate({
  readingId,
  locale,
  t,
  onUnlocked,
}: {
  readingId: string;
  locale: "en" | "zh";
  t: (key: string) => string;
  onUnlocked: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(true);
  const [exempt, setExempt] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [share, setShare] = useState<SharePayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [platformHint, setPlatformHint] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<FortuneSharePlatformId | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [canSystemShare, setCanSystemShare] = useState(false);

  useEffect(() => {
    setCanSystemShare(typeof navigator.share === "function");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/fortune/share-unlock?readingId=${encodeURIComponent(readingId)}&locale=${locale}`,
      );
      const data = await res.json();
      setRequired(Boolean(data.required));
      setExempt(Boolean(data.exempt));
      setUnlocked(Boolean(data.unlocked));
      setShare(data.share ?? null);
      if (data.unlocked || data.exempt) onUnlocked();
    } finally {
      setLoading(false);
    }
  }, [readingId, locale, onUnlocked]);

  useEffect(() => {
    load();
  }, [load]);

  async function markUnlocked() {
    setUnlocking(true);
    try {
      await fetch("/api/fortune/share-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readingId }),
      });
      setUnlocked(true);
      onUnlocked();
    } finally {
      setUnlocking(false);
    }
  }

  async function shareToPlatform(platform: FortuneSharePlatformId) {
    if (!share) return;
    setActivePlatform(platform);
    setPlatformHint(null);

    const action = fortunePlatformShareAction(platform, share);

    try {
      if (action.type === "copy") {
        await navigator.clipboard.writeText(action.text);
        if (platform === "wechat") {
          setPlatformHint(t("fortune.sharePlatformWechatHint"));
        } else if (platform === "instagram") {
          setPlatformHint(t("fortune.sharePlatformInstagramHint"));
          if (action.openHref) {
            window.open(action.openHref, "_blank", "noopener,noreferrer");
          }
        } else if (platform === "copy_link") {
          setLinkCopied(true);
          window.setTimeout(() => setLinkCopied(false), 2500);
        } else {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        }
      } else {
        window.open(action.href, "_blank", "noopener,noreferrer");
      }
      await markUnlocked();
    } catch {
      setPlatformHint(t("fortune.sharePlatformFailed"));
    } finally {
      setActivePlatform(null);
    }
  }

  async function nativeShare() {
    if (!share) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: share.title,
          text: share.text,
          url: share.viewUrl ?? share.url,
        });
        await markUnlocked();
        return;
      }
    } catch {
      /* user cancelled */
    }
    await shareToPlatform("copy_text");
  }

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("fortune.shareGateLoading")}
      </div>
    );
  }

  if (!share) return null;

  const gateActive = required && !unlocked;

  return (
    <div
      className={`mb-4 rounded-xl p-4 shadow-sm ${
        gateActive
          ? "border-2 border-amber-400/50 bg-amber-500/15"
          : "border border-card-border bg-card/50"
      }`}
    >
      <div className="flex items-start gap-2">
        <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {gateActive ? t("fortune.shareGateTitle") : t("fortune.shareGateShareTitle")}
          </p>
          {gateActive ? (
            <p className="mt-1 text-xs text-muted">
              {exempt ? t("fortune.shareGateDescOwner") : t("fortune.shareGateDesc")}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-xs font-medium text-muted">{t("fortune.shareGatePickPlatform")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {FORTUNE_SHARE_PLATFORMS.map((platform) => {
          const busy = activePlatform === platform.id;
          const done =
            (platform.id === "copy_link" && linkCopied) ||
            (platform.id === "copy_text" && copied);
          return (
            <button
              key={platform.id}
              type="button"
              disabled={busy || unlocking}
              onClick={() => void shareToPlatform(platform.id)}
              className={platformBtn}
            >
              <span className="text-lg leading-none">{platform.emoji}</span>
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : done ? (
                <CheckCircle2 className="h-3 w-3 text-success" />
              ) : (
                <span>{t(platform.labelKey)}</span>
              )}
            </button>
          );
        })}
      </div>

      {canSystemShare ? (
        <button
          type="button"
          onClick={() => void nativeShare()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl btn-premium px-3 py-2 text-xs"
        >
          <Share2 className="h-3.5 w-3.5" />
          {t("fortune.shareGateSystemShare")}
        </button>
      ) : null}

      {share.viewUrl ? (
        <p className="mt-3 break-all text-[11px] text-muted">
          {t("fortune.shareGateViewLink")}:{" "}
          <span className="text-accent">{share.viewUrl}</span>
        </p>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
          {t("fortune.shareGatePreviewText")}
        </summary>
        <p className="mt-2 rounded-lg border border-card-border bg-background/90 p-3 text-xs text-foreground whitespace-pre-wrap">
          {share.text}
        </p>
      </details>

      {platformHint ? (
        <p className="mt-2 text-xs text-success">{platformHint}</p>
      ) : null}

      {gateActive ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-card-border/60 pt-3">
          <button
            type="button"
            disabled={unlocking}
            onClick={markUnlocked}
            className="inline-flex items-center gap-1.5 rounded-lg border border-card-border bg-background px-3 py-2 text-xs text-foreground hover:border-accent/50"
          >
            {unlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t("fortune.shareGateDoneBtn")}
          </button>
          {exempt ? (
            <button
              type="button"
              disabled={unlocking}
              onClick={markUnlocked}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-muted px-3 py-2 text-xs text-muted hover:text-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" />
              {t("fortune.shareGateSkipOwner")}
            </button>
          ) : null}
        </div>
      ) : exempt && !unlocked ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-card-border/60 pt-3">
          <button
            type="button"
            disabled={unlocking}
            onClick={markUnlocked}
            className="inline-flex items-center gap-1.5 rounded-lg btn-premium px-3 py-2 text-xs"
          >
            {unlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
            {t("fortune.shareGateSkipOwner")}
          </button>
        </div>
      ) : null}

      {gateActive && required ? (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{t("fortune.shareGateRequiredHint")}</p>
      ) : null}
    </div>
  );
}
