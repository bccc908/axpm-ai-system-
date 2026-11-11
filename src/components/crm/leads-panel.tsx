"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import type { CrmLead, CrmLeadRecordStatus } from "@/types/crm-zoho";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

function statusVariant(status: CrmLeadRecordStatus) {
  if (status === "converted") return "success" as const;
  if (status === "unqualified") return "muted" as const;
  if (status === "qualified") return "default" as const;
  return "warning" as const;
}

export function LeadsPanel() {
  const { t } = useLocale();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/leads?status=open");
      const data = await res.json();
      setLeads(data.leads ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function convertLead(id: string) {
    setConverting(id);
    try {
      const res = await fetch(`/api/crm/leads/${id}/convert`, { method: "POST" });
      if (res.ok) await load();
    } finally {
      setConverting(null);
    }
  }

  async function addLead() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          company: company.trim() || null,
          source: source.trim() || "manual",
        }),
      });
      setName("");
      setEmail("");
      setCompany("");
      setSource("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("zoho.leadName")} />
        <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("zoho.leadEmail")} />
        <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("zoho.leadCompany")} />
        <input className={inputClass} value={source} onChange={(e) => setSource(e.target.value)} placeholder={t("zoho.leadSource")} />
      </div>
      <button
        type="button"
        disabled={saving || !name.trim()}
        onClick={() => void addLead()}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {t("zoho.addLead")}
      </button>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted">{t("zoho.noLeads")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-card-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-card-border bg-background/60 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">{t("zoho.colName")}</th>
                <th className="px-4 py-3">{t("zoho.colCompany")}</th>
                <th className="px-4 py-3">{t("zoho.colSource")}</th>
                <th className="px-4 py-3">{t("zoho.colStatus")}</th>
                <th className="px-4 py-3">{t("zoho.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-card-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/crm/leads/${lead.id}`} className="font-medium text-foreground hover:text-accent">
                      {lead.name}
                    </Link>
                    {lead.email && <p className="text-xs text-muted">{lead.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.company ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(lead.status)}>
                      {t(`zoho.leadStatus.${lead.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {lead.client_id && (
                        <Link href={`/dashboard/clients/${lead.client_id}`} className="text-xs text-accent hover:underline">
                          {t("zoho.viewContact")}
                        </Link>
                      )}
                      {lead.status !== "converted" && (
                        <button
                          type="button"
                          disabled={converting === lead.id}
                          onClick={() => void convertLead(lead.id)}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
                        >
                          {converting === lead.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3 w-3" />
                          )}
                          {t("zoho.convertLead")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
