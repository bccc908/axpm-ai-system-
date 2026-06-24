"use client";

import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { CardHeader } from "@/components/ui/card";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

type Props = {
  target: "contact" | "lead";
  recordId: string;
  defaultTo?: string | null;
  onSent?: () => void;
};

export function CrmSendEmail({ target, recordId, defaultTo, onSent }: Props) {
  const { t } = useLocale();
  const [to, setTo] = useState(defaultTo ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendEmail() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const endpoint =
        target === "contact"
          ? `/api/crm/contacts/${recordId}/email`
          : `/api/crm/leads/${recordId}/email`;
      const res = await fetch(endpoint, {
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
        setError(data.error ?? t("zoho.emailFailed"));
        return;
      }
      setMessage(t("zoho.emailSent"));
      setSubject("");
      setBody("");
      onSent?.();
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <CardHeader title={t("zoho.sendEmailTitle")} description={t("zoho.sendEmailDesc")} />
      <div className="mt-3 space-y-3">
        <input
          className={inputClass}
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={t("zoho.emailTo")}
        />
        <input
          className={inputClass}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("zoho.emailSubject")}
        />
        <textarea
          className={`${inputClass} min-h-[120px] resize-y`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("zoho.emailBody")}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-success">{message}</p>}
        <button
          type="button"
          disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
          onClick={() => void sendEmail()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {t("zoho.sendEmail")}
        </button>
        {!defaultTo && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Mail className="h-3.5 w-3.5" />
            {t("zoho.emailNeedsAddress")}
          </p>
        )}
      </div>
    </div>
  );
}
