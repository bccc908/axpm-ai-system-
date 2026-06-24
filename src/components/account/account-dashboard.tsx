"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  CreditCard,
  KeyRound,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardHeader } from "@/components/ui/card";
import type { CustomerAccountPublic, CustomerApiKeyPublic } from "@/lib/customer/types";
import { PLAN_CONFIG } from "@/lib/customer/plans";
import { ReferralLinkCard } from "@/components/account/referral-link-card";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted hover:text-foreground";

export function AccountDashboard() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<CustomerAccountPublic | null>(null);
  const [keys, setKeys] = useState<CustomerApiKeyPublic[]>([]);
  const [deepseekKey, setDeepseekKey] = useState("");
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState("https://api.deepseek.com");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-chat");
  const [keyLabel, setKeyLabel] = useState("My app");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [referralLinks, setReferralLinks] = useState<{
    zh: string;
    en: string;
    auto: string;
  } | null>(null);

  const load = useCallback(async () => {
    const [accountRes, keysRes] = await Promise.all([
      fetch("/api/account"),
      fetch("/api/account/api-keys"),
    ]);
    const accountData = await accountRes.json();
    const keysData = await keysRes.json();
    setAccount(accountData.account ?? null);
    setReferralLinks(accountData.referralLinks ?? null);
    setKeys(keysData.keys ?? []);
    if (accountData.account?.integrations?.deepseek_base_url) {
      setDeepseekBaseUrl(accountData.account.integrations.deepseek_base_url);
    }
    if (accountData.account?.integrations?.deepseek_model) {
      setDeepseekModel(accountData.account.integrations.deepseek_model);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function saveIntegrations() {
    setBusy("integrations");
    setMessage(null);
    try {
      const res = await fetch("/api/account/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deepseek_api_key: deepseekKey.trim() || null,
          deepseek_base_url: deepseekBaseUrl.trim() || null,
          deepseek_model: deepseekModel.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("account.saveFailed"));
        return;
      }
      setDeepseekKey("");
      setMessage(t("account.integrationsSaved"));
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function startCheckout(plan: "basic" | "pro") {
    setBusy(`checkout-${plan}`);
    setMessage(null);
    try {
      const res = await fetch("/api/account/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("account.checkoutFailed"));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.message ?? t("account.planActivated"));
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function startTrial() {
    setBusy("trial");
    setMessage(null);
    try {
      const res = await fetch("/api/account/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", action: "trial" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("account.trialFailed"));
        return;
      }
      setMessage(t("account.trialStarted"));
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function createApiKey() {
    setBusy("create-key");
    setNewSecret(null);
    setMessage(null);
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: keyLabel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("account.keyCreateFailed"));
        return;
      }
      setNewSecret(data.secret);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function deleteApiKey(id: string) {
    setBusy(`delete-${id}`);
    await fetch(`/api/account/api-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const planLabel = (plan: keyof typeof PLAN_CONFIG) =>
    PLAN_CONFIG[plan].label[locale === "zh" ? "zh" : "en"];
  const planPrice = (plan: keyof typeof PLAN_CONFIG) =>
    PLAN_CONFIG[plan].priceLabel[locale === "zh" ? "zh" : "en"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("account.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("account.subtitle")}</p>
      </div>

      {message ? (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {message}
        </div>
      ) : null}

      <ReferralLinkCard
        links={referralLinks}
        referralCount={account?.referral_count ?? 0}
      />

      <Card>
        <CardHeader title={t("account.planTitle")} description={t("account.planDesc")} />
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-accent/10 px-3 py-1 text-accent">
              {planLabel(account?.plan ?? "free")} · {account?.status ?? "active"}
            </span>
            <span className="text-muted">
              {t("account.usage", {
                used: account?.readings_today ?? 0,
                limit: account?.readings_limit ?? 2,
              })}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(["free", "basic", "pro"] as const).map((plan) => (
              <div key={plan} className="rounded-xl border border-card-border p-4">
                <div className="font-semibold text-foreground">{planLabel(plan)}</div>
                <div className="mt-1 text-muted">{planPrice(plan)}</div>
                <div className="mt-2 text-xs text-muted">
                  {t("account.readingsPerDay", { count: PLAN_CONFIG[plan].readingsPerDay })}
                </div>
                {plan !== "free" && account?.plan !== plan ? (
                  <button
                    type="button"
                    className={`${btnPrimary} mt-4 w-full justify-center`}
                    disabled={Boolean(busy)}
                    onClick={() => startCheckout(plan)}
                  >
                    {busy === `checkout-${plan}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {t("account.subscribe")}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <button type="button" className={btnGhost} disabled={Boolean(busy)} onClick={startTrial}>
            {busy === "trial" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("account.startTrial")}
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("account.integrationsTitle")} description={t("account.integrationsDesc")} />
        <div className="space-y-3 text-sm">
          <p className="text-muted">{t("account.integrationsHint")}</p>
          <input
            className={inputClass}
            type="password"
            placeholder={
              account?.integrations.deepseek_configured
                ? t("account.deepseekConfigured")
                : t("account.deepseekPlaceholder")
            }
            value={deepseekKey}
            onChange={(e) => setDeepseekKey(e.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className={inputClass}
              value={deepseekBaseUrl}
              onChange={(e) => setDeepseekBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com"
            />
            <input
              className={inputClass}
              value={deepseekModel}
              onChange={(e) => setDeepseekModel(e.target.value)}
              placeholder="deepseek-chat"
            />
          </div>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy === "integrations"}
            onClick={saveIntegrations}
          >
            {busy === "integrations" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("account.saveIntegrations")}
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("account.apiKeysTitle")} description={t("account.apiKeysDesc")} />
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-xs`}
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              placeholder={t("account.keyLabel")}
            />
            <button type="button" className={btnPrimary} disabled={Boolean(busy)} onClick={createApiKey}>
              {busy === "create-key" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t("account.createKey")}
            </button>
          </div>

          {newSecret ? (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <p className="font-medium text-foreground">{t("account.newKeyOnce")}</p>
              <code className="mt-2 block break-all text-xs">{newSecret}</code>
              <button
                type="button"
                className={`${btnGhost} mt-3`}
                onClick={() => navigator.clipboard.writeText(newSecret)}
              >
                <Copy className="h-3.5 w-3.5" />
                {t("account.copyKey")}
              </button>
            </div>
          ) : null}

          <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted">
{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/fortune/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"topic":"combined","locale":"${locale}"}'`}
          </pre>

          {keys.length === 0 ? (
            <p className="text-muted">{t("account.noKeys")}</p>
          ) : (
            <ul className="space-y-2">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border border-card-border px-3 py-2"
                >
                  <div>
                    <div className="font-medium text-foreground">{key.label}</div>
                    <div className="text-xs text-muted">{key.key_prefix}…</div>
                  </div>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={busy === `delete-${key.id}`}
                    onClick={() => deleteApiKey(key.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("account.fortuneTitle")} description={t("account.fortuneDesc")} />
        <Link href="/dashboard/fortune" className={`${btnPrimary} inline-flex`}>
          <Sparkles className="h-4 w-4" />
          {t("account.openFortune")}
        </Link>
        {user?.role !== "customer" ? (
          <p className="mt-3 text-xs text-muted">{t("account.internalUserNote")}</p>
        ) : null}
      </Card>
    </div>
  );
}
