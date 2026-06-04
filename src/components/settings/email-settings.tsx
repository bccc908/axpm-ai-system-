"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, Send, XCircle } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import type { EmailLogEntry, EmailProvider, EmailSettings } from "@/types/email";

type EmailStatus = {
  isReady: boolean;
  hasCredentials: boolean;
  hasRecipients: boolean;
  settings: EmailSettings;
  smtp: { host: string; port: number; secure: boolean; fromEmail: string };
  presets: Record<string, { labelEn: string; labelZh: string; hintEn: string; hintZh: string; region: string }>;
};

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export function EmailSettingsPanel() {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [log, setLog] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<EmailProvider>("qq");
  const [customHost, setCustomHost] = useState("");
  const [customPort, setCustomPort] = useState(587);
  const [customSecure, setCustomSecure] = useState(false);
  const [fromName, setFromName] = useState("AXPM Operations");
  const [recipients, setRecipients] = useState("");
  const [ccRecipients, setCcRecipients] = useState("");
  const [emailLocale, setEmailLocale] = useState<"en" | "zh" | "both">("both");
  const [timezone, setTimezone] = useState<EmailSettings["timezone"]>("Asia/Kuala_Lumpur");
  const [autoDigest, setAutoDigest] = useState(true);
  const [autoPayments, setAutoPayments] = useState(true);
  const [autoFollowUps, setAutoFollowUps] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/status");
      const data = await res.json();
      const s = data.email as EmailStatus;
      setStatus(s);
      setLog(data.log ?? []);
      const cfg = s.settings;
      setEnabled(cfg.enabled);
      setProvider(cfg.provider);
      setCustomHost(cfg.customHost);
      setCustomPort(cfg.customPort);
      setCustomSecure(cfg.customSecure);
      setFromName(cfg.fromName);
      setRecipients(cfg.recipients.join(", "));
      setCcRecipients(cfg.ccRecipients.join(", "));
      setEmailLocale(cfg.locale);
      setTimezone(cfg.timezone);
      setAutoDigest(cfg.auto.dailyDigest);
      setAutoPayments(cfg.auto.paymentReminders);
      setAutoFollowUps(cfg.auto.clientFollowUps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/email/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          provider,
          customHost,
          customPort,
          customSecure,
          fromName,
          recipients: recipients.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
          ccRecipients: ccRecipients.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
          locale: emailLocale,
          timezone,
          auto: {
            dailyDigest: autoDigest,
            paymentReminders: autoPayments,
            clientFollowUps: autoFollowUps,
          },
        }),
      });
      if (!res.ok) {
        setMessage(t("email.saveFailed"));
        return;
      }
      setMessage(t("email.saved"));
      load();
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/email/test", { method: "POST" });
      const data = await res.json();
      if (data.sent) {
        setMessage(t("email.testSent"));
      } else {
        setMessage(data.error ?? t("email.testFailed"));
      }
      load();
    } finally {
      setTesting(false);
    }
  }

  if (loading || !status) {
    return (
      <Card>
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      </Card>
    );
  }

  const preset = status.presets[provider];
  const presetHint = preset ? (locale === "zh" ? preset.hintZh : preset.hintEn) : "";
  const presetLabel = preset ? (locale === "zh" ? preset.labelZh : preset.labelEn) : provider;

  const Status = ({ ok }: { ok: boolean }) =>
    ok ? (
      <span className="inline-flex items-center gap-1 text-success">
        <CheckCircle2 className="h-4 w-4" />
        {t("settings.connected")}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted">
        <XCircle className="h-4 w-4" />
        {t("settings.notConfigured")}
      </span>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t("email.title")}
          description={t("email.subtitle")}
        />
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent" />
            <span>{t("email.smtpStatus")}</span>
            <Status ok={status.isReady} />
          </div>
          <div className="flex gap-4 text-muted">
            <span>{t("email.credentials")}: {status.hasCredentials ? "✓" : "✗"}</span>
            <span>{t("email.recipients")}: {status.hasRecipients ? "✓" : "✗"}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {t("email.enableAuto")}
          </label>

          <div>
            <label className="mb-1 block text-sm text-muted">{t("email.provider")}</label>
            <select className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value as EmailProvider)}>
              {Object.entries(status.presets).map(([id, p]) => (
                <option key={id} value={id}>
                  {locale === "zh" ? p.labelZh : p.labelEn}
                  {p.region === "cn" ? " 🇨🇳" : p.region === "my" ? " 🇲🇾" : ""}
                </option>
              ))}
              <option value="custom">{t("email.customSmtp")}</option>
            </select>
            {presetHint && (
              <p className="mt-1 text-xs text-muted">{presetLabel}: {presetHint}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">{t("email.timezone")}</label>
            <select className={inputClass} value={timezone} onChange={(e) => setTimezone(e.target.value as EmailSettings["timezone"])}>
              <option value="Asia/Kuala_Lumpur">{t("email.tzMalaysia")}</option>
              <option value="Asia/Shanghai">{t("email.tzChina")}</option>
              <option value="Asia/Hong_Kong">{t("email.tzHongKong")}</option>
            </select>
          </div>

          {provider === "custom" && (
            <>
              <input className={inputClass} placeholder="SMTP Host" value={customHost} onChange={(e) => setCustomHost(e.target.value)} />
              <input type="number" className={inputClass} placeholder="Port" value={customPort} onChange={(e) => setCustomPort(Number(e.target.value))} />
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={customSecure} onChange={(e) => setCustomSecure(e.target.checked)} />
                SSL/TLS (port 465)
              </label>
            </>
          )}

          <input className={inputClass} placeholder={t("email.fromName")} value={fromName} onChange={(e) => setFromName(e.target.value)} />
          <select className={inputClass} value={emailLocale} onChange={(e) => setEmailLocale(e.target.value as "en" | "zh" | "both")}>
            <option value="both">{t("email.localeBoth")}</option>
            <option value="en">{t("lang.en")}</option>
            <option value="zh">{t("lang.zh")}</option>
          </select>

          <input className={`${inputClass} sm:col-span-2`} placeholder={t("email.recipientsPlaceholder")} value={recipients} onChange={(e) => setRecipients(e.target.value)} />
          <input className={`${inputClass} sm:col-span-2`} placeholder={t("email.ccPlaceholder")} value={ccRecipients} onChange={(e) => setCcRecipients(e.target.value)} />
        </div>

        <p className="mt-3 text-xs text-muted">{t("email.envHint")}</p>
        {status.smtp.host && (
          <p className="mt-1 text-xs text-muted">
            SMTP: {status.smtp.host}:{status.smtp.port} · {status.smtp.fromEmail || "—"}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-foreground">{t("email.autoTypes")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoDigest} onChange={(e) => setAutoDigest(e.target.checked)} />
            {t("email.autoDigest")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPayments} onChange={(e) => setAutoPayments(e.target.checked)} />
            {t("email.autoPayments")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoFollowUps} onChange={(e) => setAutoFollowUps(e.target.checked)} />
            {t("email.autoFollowUps")}
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
          >
            {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : t("common.save")}
          </button>
          <button
            type="button"
            onClick={sendTest}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-card-border/50 disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("email.sendTest")}
          </button>
        </div>

        {message && <p className="mt-3 text-sm text-accent">{message}</p>}
      </Card>

      {log.length > 0 && (
        <Card>
          <CardHeader title={t("email.recentLog")} />
          <div className="space-y-2 text-sm">
            {log.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex justify-between gap-2 border-b border-card-border/50 pb-2">
                <span className={entry.ok ? "text-foreground" : "text-danger"}>{entry.subject}</span>
                <span className="shrink-0 text-xs text-muted">{new Date(entry.sentAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
