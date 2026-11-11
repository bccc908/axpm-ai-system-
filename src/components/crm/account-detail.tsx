"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2, Plus, Save, Trash2, TrendingUp, User } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { CrmAccount, CrmLead } from "@/types/crm-zoho";
import type { Client } from "@/types/database";
import type { CrmDeal } from "@/types/crm-pro";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function AccountDetail({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const [account, setAccount] = useState<CrmAccount | null>(null);
  const [contacts, setContacts] = useState<Client[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [customRows, setCustomRows] = useState<{ key: string; value: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/accounts/${accountId}`);
      const data = await res.json();
      if (!res.ok) return;
      setAccount(data.account);
      setContacts(data.contacts ?? []);
      setLeads(data.leads ?? []);
      setDeals(data.deals ?? []);
      setNotes(data.account.notes ?? "");
      setPhone(data.account.phone ?? "");
      setIndustry(data.account.industry ?? "");
      setWebsite(data.account.website ?? "");
      const fields = data.account.custom_fields ?? {};
      setCustomRows(Object.entries(fields).map(([key, value]) => ({ key, value: String(value) })));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!account) return;
    setSaving(true);
    try {
      const custom_fields: Record<string, string> = {};
      for (const row of customRows) {
        const k = row.key.trim();
        if (k) custom_fields[k] = row.value.trim();
      }
      await fetch(`/api/crm/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, phone, industry, website, custom_fields }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (!account) {
    return <p className="text-muted">{t("zoho.accountNotFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/crm?tab=accounts"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("zoho.backToAccounts")}
      </Link>

      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent/10 p-3">
          <Building2 className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{account.name}</h1>
          <p className="text-sm text-muted">{industry || t("zoho.tabAccounts")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="p-4 sm:p-6">
            <CardHeader title={t("zoho.accountInfo")} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("zoho.accountPhone")} />
              <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder={t("zoho.accountWebsite")} />
              <input className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={t("zoho.accountIndustry")} />
            </div>
            <textarea
              className={`${inputClass} mt-3 min-h-[90px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("crmPro.notes")}
            />
          </Card>

          <Card className="p-4 sm:p-6">
            <CardHeader title={t("zoho.customFields")} description={t("zoho.customFieldsDesc")} />
            <div className="mt-4 space-y-2">
              {customRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inputClass} value={row.key} onChange={(e) => {
                    const next = [...customRows];
                    next[i] = { ...next[i], key: e.target.value };
                    setCustomRows(next);
                  }} placeholder={t("zoho.fieldName")} />
                  <input className={inputClass} value={row.value} onChange={(e) => {
                    const next = [...customRows];
                    next[i] = { ...next[i], value: e.target.value };
                    setCustomRows(next);
                  }} placeholder={t("zoho.fieldValue")} />
                  <button type="button" onClick={() => setCustomRows(customRows.filter((_, j) => j !== i))} className="rounded-lg border border-card-border p-2 text-muted hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setCustomRows([...customRows, { key: "", value: "" }])} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                <Plus className="h-3 w-3" />
                {t("zoho.addCustomField")}
              </button>
            </div>
            <button type="button" disabled={saving} onClick={() => void save()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("common.save")}
            </button>
          </Card>
        </div>

        <Card className="p-4">
          <CardHeader title={t("zoho.relatedLists")} />
          <div className="mt-3 space-y-4 text-sm">
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-medium">
                <User className="h-4 w-4 text-muted" />
                {t("zoho.tabContacts")} ({contacts.length})
              </p>
              <ul className="space-y-1">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <Link href={`/dashboard/clients/${c.id}`} className="text-xs text-accent hover:underline">{c.name}</Link>
                  </li>
                ))}
                {contacts.length === 0 && <p className="text-xs text-muted">{t("zoho.notLinked")}</p>}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-medium">{t("zoho.tabLeads")} ({leads.length})</p>
              <ul className="space-y-1">
                {leads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/dashboard/crm/leads/${l.id}`} className="text-xs text-accent hover:underline">{l.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-medium">
                <TrendingUp className="h-4 w-4 text-muted" />
                {t("zoho.tabDeals")} ({deals.length})
              </p>
              <ul className="space-y-1">
                {deals.map((d) => (
                  <li key={d.id} className="text-xs text-foreground">
                    {d.title} · {formatCurrency(d.amount, d.currency)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
