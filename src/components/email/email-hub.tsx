"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { EmailSettingsPanel } from "@/components/settings/email-settings";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const inputClass =
  "input-premium w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none";

export function EmailHub() {
  const { t } = useLocale();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendMail() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("email.sendFailed"));
        return;
      }
      setMessage(t("email.sendOk"));
      setSubject("");
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t("email.title")} subtitle={t("email.pageSubtitle")} />

      <Card>
        <CardHeader title={t("email.composeTitle")} description={t("email.composeDesc")} />
        <div className="space-y-3">
          <input
            type="email"
            className={inputClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t("email.composeTo")}
          />
          <input
            className={inputClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("email.composeSubject")}
          />
          <textarea
            className={`${inputClass} min-h-[140px] resize-y`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("email.composeBody")}
          />
          <button
            type="button"
            disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
            onClick={() => void sendMail()}
            className="inline-flex items-center gap-2 rounded-xl btn-premium px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("email.composeSend")}
          </button>
          {message ? <p className="text-sm text-success">{message}</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      </Card>

      <EmailSettingsPanel showPageTitle={false} />
    </div>
  );
}
