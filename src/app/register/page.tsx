"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type { Locale } from "@/lib/i18n";

export default function RegisterPage() {
  const { t, locale, setLocale } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [wechat, setWechat] = useState("");
  const [ibSource, setIbSource] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          wechat: wechat.trim() || undefined,
          ib_source: ibSource.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.toString() ?? t("register.submitFailed"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("register.networkError"));
    } finally {
      setLoading(false);
    }
  }

  function LangButton({ code, label }: { code: Locale; label: string }) {
    return (
      <button
        type="button"
        onClick={() => setLocale(code)}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          locale === code
            ? "bg-accent text-accent-foreground"
            : "border border-card-border text-muted hover:text-foreground"
        }`}
      >
        {label}
      </button>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-card-border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-4 text-xl font-bold text-foreground">{t("register.thankYou")}</h1>
          <p className="mt-2 text-sm text-muted">{t("register.thankYouDesc")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border border-card-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("register.title")}</h1>
            <p className="mt-1 text-sm text-muted">{t("register.subtitle")}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <LangButton code="zh" label={t("register.langZh")} />
            <LangButton code="en" label={t("register.langEn")} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {t("register.name")} *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                {t("register.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                {t("register.phone")}
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("register.phonePlaceholder")}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                {t("register.whatsapp")}
              </label>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                {t("register.wechat")}
              </label>
              <input
                value={wechat}
                onChange={(e) => setWechat(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {t("register.ibSource")}
            </label>
            <input
              value={ibSource}
              onChange={(e) => setIbSource(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              {t("register.message")}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm resize-y"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("register.submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
