"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Settings } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";

type Status = {
  llm: boolean;
  llmLabel: string;
  telegram: boolean;
  email: boolean;
  wechatWork: boolean;
  wechatCanSend: boolean;
  whatsapp: boolean;
  googleDrive: boolean;
};

export function IntegrationsStatus() {
  const { t } = useLocale();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setStatus({
          llm: Boolean(d.integrations?.llm?.configured ?? d.integrations?.openai?.configured),
          llmLabel: d.integrations?.llm?.label ?? "AI",
          telegram: Boolean(d.integrations?.telegram?.isReady),
          email: Boolean(d.integrations?.email?.isReady),
          wechatWork: Boolean(d.integrations?.wechatWork?.configured),
          wechatCanSend: Boolean(d.integrations?.wechatWork?.canSend),
          whatsapp: Boolean(d.integrations?.whatsapp?.configured),
          googleDrive: Boolean(d.integrations?.googleDrive?.configured),
        });
      })
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  const items = [
    { ok: status.llm, label: status.llmLabel, hint: t("help.openai") },
    { ok: status.telegram, label: "Telegram", hint: t("help.telegram") },
    { ok: status.email, label: "Email", hint: t("help.email") },
    { ok: status.wechatCanSend, label: "WeChat Work 企业微信", hint: t("help.wechatWork") },
    { ok: status.whatsapp, label: "WhatsApp", hint: t("help.whatsapp") },
    { ok: status.googleDrive, label: "Google Drive", hint: t("help.googleDrive") },
  ];

  const missing = items.filter((i) => !i.ok);
  if (missing.length === 0) return null;

  return (
    <Card className="border-warning/40 bg-warning/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{t("help.someNotReady")}</p>
          <p className="mt-1 text-sm text-muted">{t("help.someNotReadyDesc")}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {missing.map((item) => (
              <li key={item.label} className="flex items-start gap-2">
                <span className="text-warning">○</span>
                <span>
                  <strong className="text-foreground">{item.label}</strong>
                  <span className="text-muted"> — {item.hint}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/settings"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <Settings className="h-4 w-4" />
            {t("help.goSettings")}
          </Link>
        </div>
      </div>
    </Card>
  );
}
