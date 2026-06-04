"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";

export function RegisterLinkBanner() {
  const { t } = useLocale();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/public/register")
      .then((r) => r.json())
      .then((d) => setUrl(d.registerUrl ?? `${window.location.origin}/register`))
      .catch(() => setUrl(`${typeof window !== "undefined" ? window.location.origin : ""}/register`));
  }, []);

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-accent/25 bg-accent/5">
      <CardHeader
        title={t("clients.autoRecordTitle")}
        description={t("clients.autoRecordDesc")}
      />
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted">{t("clients.registerLink")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-lg border border-card-border bg-background px-3 py-2 text-xs">
            {url || "/register"}
          </code>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1 rounded-lg border border-card-border px-3 py-2 text-xs text-accent hover:bg-card"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t("ai.copied") : t("clients.copyLink")}
          </button>
          <a
            href={url || "/register"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-card-border px-3 py-2 text-xs text-accent hover:bg-card"
          >
            <Link2 className="h-3.5 w-3.5" />
            {t("clients.openRegister")}
          </a>
        </div>
        <ul className="list-disc pl-5 text-xs text-muted space-y-1">
          <li>{t("clients.autoChatHint")}</li>
          <li>{t("clients.autoRegisterHint")}</li>
        </ul>
      </div>
    </Card>
  );
}
