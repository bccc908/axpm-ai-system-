"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Trash2, X, ExternalLink } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VoiceTextarea } from "@/components/ui/voice-field";
import { formatDateLocalized } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import { RegisterLinkBanner } from "@/components/crm/register-link-banner";
import type { Client, LeadStatus, TeamMember } from "@/types/database";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted transition-colors disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted hover:text-foreground";

const LEAD_STATUSES: LeadStatus[] = [
  "new", "contacted", "qualified", "negotiating", "deposited", "active", "dormant", "lost",
];

const leadStatusVariant: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  new: "muted",
  contacted: "default",
  qualified: "default",
  negotiating: "warning",
  deposited: "success",
  active: "success",
  dormant: "muted",
  lost: "danger",
};

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function tagsToString(tags: string[]): string {
  return tags.join(", ");
}

export function ClientsManager({ embedded }: { embedded?: boolean }) {
  const { t, locale } = useLocale();
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [wechat, setWechat] = useState("");
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("new");
  const [deposit, setDeposit] = useState("");
  const [ibSource, setIbSource] = useState("");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setWhatsapp("");
    setWechat("");
    setLeadStatus("new");
    setDeposit("");
    setIbSource("");
    setNotes("");
    setNextFollowUp("");
    setAssignedTo("");
    setTagsStr("");
    setFollowUpNotes("");
  }

  function startEdit(client: Client) {
    setEditingId(client.id);
    setShowForm(false);
    setName(client.name);
    setEmail(client.email ?? "");
    setPhone(client.phone ?? "");
    setWhatsapp(client.whatsapp ?? "");
    setWechat(client.wechat ?? "");
    setLeadStatus(client.lead_status);
    setDeposit(client.deposit_amount > 0 ? String(client.deposit_amount) : "");
    setIbSource(client.ib_source ?? "");
    setNotes(client.notes ?? "");
    setNextFollowUp(client.next_follow_up_at ? client.next_follow_up_at.slice(0, 16) : "");
    setAssignedTo(client.assigned_to ?? "");
    setTagsStr(tagsToString(client.tags));
    setFollowUpNotes("");
  }

  function cancelEdit() {
    setEditingId(null);
    resetForm();
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clientRes, teamRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/team"),
      ]);
      const [clientData, teamData] = await Promise.all([clientRes.json(), teamRes.json()]);
      setClients(clientData.clients ?? []);
      setTeamMembers(teamData.teamMembers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function clientPayload() {
    return {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      wechat: wechat.trim() || null,
      lead_status: leadStatus,
      deposit_amount: deposit ? Number(deposit) : 0,
      ib_source: ibSource.trim() || null,
      notes: notes.trim() || null,
      next_follow_up_at: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
      assigned_to: assignedTo || null,
      tags: parseTags(tagsStr),
    };
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload()),
      });
      resetForm();
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !name.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/clients/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload()),
      });
      cancelEdit();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function logFollowUp(clientId: string) {
    if (!followUpNotes.trim()) return;
    await fetch("/api/crm/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        channel: "phone",
        summary: followUpNotes.trim(),
      }),
    });
    setFollowUpNotes("");
    alert(t("clients.followUpLogged"));
    load();
  }

  async function deleteClient(id: string) {
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    load();
  }

  function renderClientFields() {
    return (
      <>
        <input className={inputClass} placeholder={`${t("clients.name")} *`} value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputClass} placeholder={t("clients.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputClass} placeholder={t("clients.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={inputClass} placeholder={t("clients.whatsapp")} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        <input className={inputClass} placeholder={t("clients.wechat")} value={wechat} onChange={(e) => setWechat(e.target.value)} />
        <select className={inputClass} value={leadStatus} onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`clients.leadStatus.${s}` as "clients.leadStatus.new")}
            </option>
          ))}
        </select>
        <input type="number" className={inputClass} placeholder={t("clients.deposit")} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        <input className={inputClass} placeholder={t("clients.ibSource")} value={ibSource} onChange={(e) => setIbSource(e.target.value)} />
        <input type="datetime-local" className={inputClass} value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} title={t("clients.nextFollowUp")} />
        <select className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">{t("clients.unassigned")}</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input className={`${inputClass} sm:col-span-2`} placeholder={t("clients.tagsPlaceholder")} value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} />
        <VoiceTextarea className={`${inputClass} sm:col-span-2`} placeholder={t("common.notes")} value={notes} onValueChange={setNotes} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("clients.title")}</h1>
            <p className="mt-1 text-muted">{t("clients.subtitle")}</p>
          </div>
          <button type="button" onClick={() => { setShowForm(!showForm); cancelEdit(); }} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            {t("clients.addClient")}
          </button>
        </div>
      )}

      {embedded && (
        <div className="flex justify-end">
          <button type="button" onClick={() => { setShowForm(!showForm); cancelEdit(); }} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            {t("clients.addClient")}
          </button>
        </div>
      )}

      <RegisterLinkBanner />

      {showForm && (
        <Card>
          <CardHeader title={t("clients.addClient")} description={t("clients.subtitle")} />
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
            {renderClientFields()}
            <button type="submit" disabled={saving || !name.trim()} className={`${btnPrimary} sm:col-span-2 justify-center`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("common.save")}
            </button>
          </form>
        </Card>
      )}

      {editingId && (
        <Card>
          <CardHeader title={t("clients.editClient")} description={t("clients.subtitle")} />
          <form onSubmit={handleUpdate} className="grid gap-3 sm:grid-cols-2">
            {renderClientFields()}
            <div className="sm:col-span-2 rounded-lg border border-card-border bg-background/50 p-3">
              <p className="mb-2 text-xs font-medium text-muted">{t("clients.logFollowUp")}</p>
              <VoiceTextarea
                className={inputClass}
                placeholder={t("clients.followUpNotes")}
                value={followUpNotes}
                onValueChange={setFollowUpNotes}
              />
              <button
                type="button"
                disabled={!followUpNotes.trim()}
                onClick={() => logFollowUp(editingId)}
                className={`${btnGhost} mt-2`}
              >
                {t("clients.logFollowUp")}
              </button>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving || !name.trim()} className={btnPrimary}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
              </button>
              <button type="button" onClick={cancelEdit} className={btnGhost}>
                <X className="h-3.5 w-3.5" /> {t("common.cancel")}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader title={t("clients.allClients")} description={t("common.records", { count: clients.length })} />
        <div className="mb-4">
          <input
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("crmPro.searchContacts")}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-8 text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-muted">
                  <th className="pb-3 pr-4 font-medium">{t("clients.name")}</th>
                  <th className="pb-3 pr-4 font-medium">{t("dashboard.status")}</th>
                  <th className="pb-3 pr-4 font-medium">{t("clients.deposit")}</th>
                  <th className="pb-3 pr-4 font-medium">{t("clients.nextFollowUp")}</th>
                  <th className="pb-3 pr-4 font-medium">{t("clients.assignedTo")}</th>
                  <th className="pb-3 font-medium">{t("clients.tags")}</th>
                  <th className="pb-3 pl-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter((client) => {
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      client.name.toLowerCase().includes(q) ||
                      client.email?.toLowerCase().includes(q) ||
                      client.phone?.includes(q) ||
                      client.tags.some((tag) => tag.toLowerCase().includes(q))
                    );
                  })
                  .map((client) => {
                  const assignee = teamMembers.find((m) => m.id === client.assigned_to);
                  return (
                    <tr key={client.id} className="border-b border-card-border/50">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        <Link href={`/dashboard/clients/${client.id}`} className="hover:text-accent">
                          {client.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={leadStatusVariant[client.lead_status] ?? "muted"}>
                          {t(`clients.leadStatus.${client.lead_status}` as "clients.leadStatus.new")}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">{client.deposit_amount > 0 ? formatCurrency(client.deposit_amount, client.deposit_currency) : "—"}</td>
                      <td className="py-3 pr-4 text-muted">
                        {client.next_follow_up_at ? formatDateLocalized(client.next_follow_up_at, locale) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-muted">{assignee?.name ?? "—"}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {client.tags.map((tag) => <Badge key={tag} variant="muted">{tag}</Badge>)}
                        </div>
                      </td>
                      <td className="py-3 pl-2">
                        <div className="flex gap-1">
                          <Link href={`/dashboard/clients/${client.id}`} className={btnGhost} title={t("crmPro.openContact")}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <button type="button" className={btnGhost} onClick={() => startEdit(client)} title={t("common.edit")}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className={btnGhost} onClick={() => deleteClient(client.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
