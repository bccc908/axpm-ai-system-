"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";

type ReferralLinks = {
  zh: string;
  en: string;
  auto: string;
};

export function ReferralLinkCard({
  links,
  referralCount,
}: {
  links: ReferralLinks | null;
  referralCount: number;
}) {
  const { t, locale } = useLocale();
  const [copied, setCopied] = useState<"zh" | "en" | "auto" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const displayLink = links
    ? locale === "zh"
      ? links.zh
      : links.en
    : "";

  async function copyLink(kind: "zh" | "en" | "auto", url: string) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }

  if (!links) return null;

  return (
    <Card className="border-accent/25 bg-accent/5">
      <CardHeader
        title={t("account.referralTitle")}
        description={t("account.referralDesc")}
      />
      <div className="space-y-3">
        <p className="text-xs text-muted">
          {t("account.referralCount", { count: referralCount })}
        </p>
        <p className="text-xs font-medium text-muted">{t("account.referralLinkLabel")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-card-border bg-background px-3 py-2 text-xs">
            {mounted ? displayLink : "…"}
          </code>
          <button
            type="button"
            onClick={() => copyLink(locale === "zh" ? "zh" : "en", displayLink)}
            className="inline-flex items-center gap-1 rounded-lg border border-card-border px-3 py-2 text-xs text-accent hover:bg-card"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t("ai.copied") : t("account.referralCopy")}
          </button>
          {mounted ? (
            <a
              href={displayLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-card-border px-3 py-2 text-xs text-accent hover:bg-card"
            >
              <Link2 className="h-3.5 w-3.5" />
              {t("account.referralPreview")}
            </a>
          ) : null}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
          <li>{t("account.referralHintZh")}</li>
          <li>{t("account.referralHintShare")}</li>
        </ul>
        <div className="rounded-lg border border-card-border bg-background/80 p-3 text-[11px] text-muted">
          <p className="font-medium text-foreground">{t("account.referralLinksBoth")}</p>
          <p className="mt-1 break-all">{links.zh}</p>
          <p className="mt-1 break-all">{links.en}</p>
        </div>
      </div>
    </Card>
  );
}
