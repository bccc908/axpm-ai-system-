"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Loader2,
  Plus,
  Save,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { CrmSendEmail } from "@/components/crm/crm-send-email";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { CrmLead, CrmLeadRecordStatus, CrmAccount } from "@/types/crm-zoho";
import type { Client } from "@/types/database";
import type { CrmDeal } from "@/types/crm-pro";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

const STATUSES: CrmLeadRecordStatus[] = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
];

export function LeadDetail({ leadId }: { leadId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [account, setAccount] = useState<CrmAccount | null>(null);
  const [deal, setDeal] = useState<CrmDeal | null>(null);
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<CrmLeadRecordStatus>("new");
  const [customRows, setCustomRows] = useState<{ key: string; value: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`);
      const data = await res.json();
      if (!res.ok) return;
      setLead(data.lead);
      setClient(data.client ?? null);
      setAccount(data.account ?? null);
      setDeal(data.deal ?? null);
      setAssignedName(data.assigned_name ?? null);
      setNotes(data.lead.notes ?? "");
      setStatus(data.lead.status);
      const fields = data.lead.custom_fields ?? {};
      setCustomRows(
        Object.entries(fields).map(([key, value]) => ({ key, value: String(value) })),
      );
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLead() {
    if (!lead) return;
    setSaving(true);
    try {
      const custom_fields: Record<string, string> = {};
      for (const row of customRows) {
        const k = row.key.trim();
        if (k) custom_fields[k] = row.value.trim();
      }
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, status, custom_fields }),
      });
      if (res.ok) await load();
    } finally {
      setSaving(false);
    }
  }

  async function convertLead() {
    setConverting(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/convert`, { method: "POST" });
      if (res.ok) {
        await load();
        router.refresh();
      }
    } finally {
      setConverting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    );
  }

  if (!lead) {
    return <p className="text-muted">{t("zoho.leadNotFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/crm?tab=leads"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("zoho.backToLeads")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {lead.company ?? lead.source ?? t("zoho.leadDetail")}
          </p>
        </div>
        {lead.status !== "converted" && (
          <button
            type="button"
            disabled={converting}
            onClick={() => void convertLead()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50"
          >
            {converting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {t("zoho.convertLead")}
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-4 sm:p-6">
            <CardHeader title={t("zoho.leadInfo")} />
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted">{t("zoho.leadEmail")}</dt>
                <dd className="font-medium">{lead.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("clients.phone")}</dt>
                <dd className="font-medium">{lead.phone ?? lead.whatsapp ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("zoho.colCompany")}</dt>
                <dd className="font-medium">{lead.company ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("zoho.colSource")}</dt>
                <dd className="font-medium">{lead.source ?? "—"}</dd>
              </div>
              {assignedName && (
                <div>
                  <dt className="text-muted">{t("clients.assignedTo")}</dt>
                  <dd className="font-medium">{assignedName}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 space-y-3">
              <label className="text-xs text-muted">{t("zoho.colStatus")}</label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as CrmLeadRecordStatus)}
                disabled={lead.status === "converted"}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`zoho.leadStatus.${s}`)}
                  </option>
                ))}
              </select>
              <label className="text-xs text-muted">{t("crmPro.notes")}</label>
              <textarea
                className={`${inputClass} min-h-[100px]`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <CrmSendEmail target="lead" recordId={leadId} defaultTo={lead.email} />
          </Card>

          <Card className="p-4 sm:p-6">
            <CardHeader title={t("zoho.customFields")} description={t("zoho.customFieldsDesc")} />
            <div className="mt-4 space-y-2">
              {customRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder={t("zoho.fieldName")}
                    value={row.key}
                    onChange={(e) => {
                      const next = [...customRows];
                      next[i] = { ...next[i], key: e.target.value };
                      setCustomRows(next);
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder={t("zoho.fieldValue")}
                    value={row.value}
                    onChange={(e) => {
                      const next = [...customRows];
                      next[i] = { ...next[i], value: e.target.value };
                      setCustomRows(next);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomRows(customRows.filter((_, j) => j !== i))}
                    className="rounded-lg border border-card-border p-2 text-muted hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCustomRows([...customRows, { key: "", value: "" }])}
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <Plus className="h-3 w-3" />
                {t("zoho.addCustomField")}
              </button>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveLead()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("common.save")}
            </button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <CardHeader title={t("zoho.relatedLists")} />
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-start gap-3 rounded-lg border border-card-border p-3">
                <User className="mt-0.5 h-4 w-4 text-muted" />
                <div>
                  <p className="font-medium">{t("zoho.tabContacts")}</p>
                  {client ? (
                    <Link href={`/dashboard/clients/${client.id}`} className="text-xs text-accent hover:underline">
                      {client.name}
                    </Link>
                  ) : (
                    <p className="text-xs text-muted">{t("zoho.notLinked")}</p>
                  )}
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-lg border border-card-border p-3">
                <Building2 className="mt-0.5 h-4 w-4 text-muted" />
                <div>
                  <p className="font-medium">{t("zoho.tabAccounts")}</p>
                  {account ? (
                    <p className="text-xs text-foreground">{account.name}</p>
                  ) : (
                    <p className="text-xs text-muted">{t("zoho.notLinked")}</p>
                  )}
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-lg border border-card-border p-3">
                <TrendingUp className="mt-0.5 h-4 w-4 text-muted" />
                <div>
                  <p className="font-medium">{t("zoho.tabDeals")}</p>
                  {deal ? (
                    <p className="text-xs text-foreground">
                      {deal.title} · {formatCurrency(deal.amount, deal.currency)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted">{t("zoho.notLinked")}</p>
                  )}
                </div>
              </li>
            </ul>
          </Card>

          <div className="rounded-lg border border-card-border p-3 text-xs text-muted">
            <Badge variant={lead.status === "converted" ? "success" : "warning"}>
              {t(`zoho.leadStatus.${lead.status}`)}
            </Badge>
            <p className="mt-2">
              {t("zoho.created")}: {new Date(lead.created_at).toLocaleString()}
            </p>
            {lead.converted_at && (
              <p>
                {t("zoho.converted")}: {new Date(lead.converted_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
