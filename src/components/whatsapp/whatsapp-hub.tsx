"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, MessageCircle, Send, XCircle } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const inputClass =
  "input-premium w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none";

type WaStatus = {
  configured: boolean;
  hasToken: boolean;
  hasPhoneNumberId: boolean;
  verifyTokenSet: boolean;
  notifyPhone: string;
  webhookUrl: string;
  publicUrlOk: boolean;
};

export function WhatsAppHub() {
  const { t } = useLocale();
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [autoReply, setAutoReply] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [waRes, settingsRes] = await Promise.all([
        fetch("/api/whatsapp/status"),
        fetch("/api/settings"),
      ]);
      const waData = await waRes.json();
      const settingsData = await settingsRes.json();
      const s = waData.whatsapp as WaStatus;
      setStatus(s);
      setNotifyPhone(s.notifyPhone ?? settingsData.settings?.whatsappNotifyPhone ?? "");
      setTo(s.notifyPhone ?? settingsData.settings?.whatsappNotifyPhone ?? "");
      setAutoReply(settingsData.settings?.autoReplyWhatsApp !== false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNotifyPhone() {
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNotifyPhone: notifyPhone.trim() || null,
          autoReplyWhatsApp: autoReply,
        }),
      });
      if (!res.ok) {
        setError(t("whatsapp.saveFailed"));
        return;
      }
      setFeedback(t("whatsapp.saved"));
      load();
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: notifyPhone.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? t("whatsapp.testFailed"));
        return;
      }
      setFeedback(t("whatsapp.testSent"));
    } finally {
      setTesting(false);
    }
  }

  async function sendMessage() {
    if (!to.trim() || !message.trim()) return;
    setSending(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("whatsapp.sendFailed"));
        return;
      }
      setFeedback(t("whatsapp.sendOk"));
      setMessage("");
    } finally {
      setSending(false);
    }
  }

  function copyWebhook() {
    if (!status?.webhookUrl) return;
    void navigator.clipboard.writeText(status.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

  if (loading || !status) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<MessageCircle className="h-4 w-4 text-accent" />}
        title={t("whatsapp.title")}
        subtitle={t("whatsapp.pageSubtitle")}
      />

      <Card>
        <CardHeader title={t("whatsapp.statusTitle")} description={t("whatsapp.statusDesc")} />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-accent" />
            <span>WhatsApp API</span>
            <Status ok={status.configured} />
          </div>
          <span className="text-muted">
            Token: {status.hasToken ? "✓" : "✗"} · Phone ID: {status.hasPhoneNumberId ? "✓" : "✗"} · Verify:{" "}
            {status.verifyTokenSet ? "✓" : "✗"}
          </span>
        </div>
        {!status.publicUrlOk ? (
          <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            {t("settings.whatsappPublicWarning")}
          </p>
        ) : (
          <p className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            {t("whatsapp.publicUrlOk")}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title={t("settings.whatsappTitle")} description={t("settings.whatsappDesc")} />
        <p className="text-xs text-muted">{t("settings.whatsappEnvKeys")}</p>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/30 p-3 text-[11px] leading-relaxed text-muted">
{`WHATSAPP_ACCESS_TOKEN=从 Meta 复制
WHATSAPP_PHONE_NUMBER_ID=从 Meta 复制
WHATSAPP_VERIFY_TOKEN=自定义口令
WHATSAPP_NOTIFY_PHONE=+60123456789`}
        </pre>
        <ol className="mt-3 space-y-1 text-xs text-muted">
          <li>{t("settings.whatsappStep1")}</li>
          <li>{t("settings.whatsappStep2")}</li>
          <li>{t("settings.whatsappStep3")}</li>
          <li>{t("settings.whatsappStep4")}</li>
          <li>{t("settings.whatsappStep5")}</li>
        </ol>
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">{t("settings.whatsappWebhookUrl")}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-xs">
              {status.webhookUrl}
            </code>
            <button
              type="button"
              onClick={copyWebhook}
              className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-accent hover:border-accent/30"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? t("settings.whatsappCopied") : t("settings.whatsappCopyWebhook")}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            {t("settings.whatsappVerifyToken")}: <Status ok={status.verifyTokenSet} />
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("whatsapp.composeTitle")} description={t("whatsapp.composeDesc")} />
        <div className="space-y-3">
          <input
            type="tel"
            className={inputClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t("whatsapp.composeTo")}
          />
          <textarea
            className={`${inputClass} min-h-[120px] resize-y`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("whatsapp.composeBody")}
          />
          <button
            type="button"
            disabled={sending || !status.configured || !to.trim() || !message.trim()}
            onClick={() => void sendMessage()}
            className="inline-flex items-center gap-2 rounded-xl btn-premium px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("whatsapp.composeSend")}
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("whatsapp.notifyTitle")} description={t("whatsapp.notifyDesc")} />
        <div className="space-y-3">
          <input
            type="tel"
            className={inputClass}
            value={notifyPhone}
            onChange={(e) => setNotifyPhone(e.target.value)}
            placeholder="+60123456789"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} />
            {t("whatsapp.autoReply")}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveNotifyPhone()}
              disabled={saving}
              className="rounded-xl btn-premium px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="inline h-4 w-4 animate-spin" /> : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => void sendTest()}
              disabled={testing || !status.configured}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm hover:border-accent/30 disabled:opacity-50"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("settings.whatsappTestSend")}
            </button>
          </div>
        </div>
      </Card>

      {feedback ? <p className="text-sm text-success">{feedback}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
