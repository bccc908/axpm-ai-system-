import "server-only";

import { randomUUID } from "crypto";
import type { Channel } from "@/types/database";
import type {
  ConvertLeadResult,
  CrmAccount,
  CrmLead,
  CrmLeadRecordStatus,
} from "@/types/crm-zoho";
import { createClient, readCrmData, writeCrmData } from "@/lib/crm/store";
import { createActivity, ensureClientDeal } from "@/lib/crm/pro-store";
import { autoAssignWebLead } from "@/lib/crm/assignment";

function sortNewest<T extends { updated_at: string }>(rows: T[]) {
  return [...rows].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function listLeads(filters?: { status?: CrmLeadRecordStatus | "open" }) {
  const data = await readCrmData();
  let leads = sortNewest(data.leads ?? []);
  if (filters?.status === "open") {
    leads = leads.filter((l) => l.status !== "converted" && l.status !== "unqualified");
  } else if (filters?.status) {
    leads = leads.filter((l) => l.status === filters.status);
  }
  return leads;
}

export async function getLead(id: string) {
  const data = await readCrmData();
  const lead = data.leads?.find((l) => l.id === id);
  if (!lead) return null;
  return normalizeLead(lead);
}

function normalizeLead(lead: CrmLead): CrmLead {
  return { ...lead, custom_fields: lead.custom_fields ?? {} };
}

export async function getLeadDetail(id: string) {
  const data = await readCrmData();
  const raw = data.leads?.find((l) => l.id === id);
  if (!raw) return null;

  const lead = normalizeLead(raw);
  const client = lead.client_id ? data.clients.find((c) => c.id === lead.client_id) ?? null : null;
  const account = lead.account_id
    ? (data.accounts ?? []).find((a) => a.id === lead.account_id) ?? null
    : null;
  const deal = lead.deal_id ? (data.deals ?? []).find((d) => d.id === lead.deal_id) ?? null : null;
  const assigned = lead.assigned_to
    ? data.teamMembers.find((m) => m.id === lead.assigned_to) ?? null
    : null;

  return {
    lead,
    client,
    account: account ? { ...account, custom_fields: account.custom_fields ?? {} } : null,
    deal,
    assigned_name: assigned?.name ?? null,
  };
}

export async function createLead(
  input: Omit<
    CrmLead,
    "id" | "created_at" | "updated_at" | "converted_at" | "client_id" | "account_id" | "deal_id" | "custom_fields"
  > & {
    client_id?: string | null;
    custom_fields?: Record<string, string>;
  },
) {
  const data = await readCrmData();
  const now = new Date().toISOString();
  const lead: CrmLead = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    wechat: input.wechat ?? null,
    company: input.company ?? null,
    title: input.title ?? null,
    source: input.source ?? null,
    channel: input.channel ?? null,
    status: input.status ?? "new",
    assigned_to: input.assigned_to ?? null,
    notes: input.notes ?? null,
    client_id: input.client_id ?? null,
    account_id: null,
    deal_id: null,
    converted_at: null,
    custom_fields: input.custom_fields ?? {},
    created_at: now,
    updated_at: now,
  };
  data.leads = data.leads ?? [];
  data.leads.unshift(lead);
  await writeCrmData(data);
  return lead;
}

export async function updateLead(id: string, patch: Partial<CrmLead>) {
  const data = await readCrmData();
  const index = data.leads?.findIndex((l) => l.id === id) ?? -1;
  if (index === -1 || !data.leads) return null;

  const current = data.leads[index];
  const lead: CrmLead = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  };
  data.leads[index] = lead;
  await writeCrmData(data);

  if (patch.status && patch.status !== current.status) {
    const { runLeadStatusWorkflows } = await import("@/lib/crm/workflows");
    await runLeadStatusWorkflows(lead, patch.status);
  }

  return lead;
}

export async function findOpenLead(params: {
  email?: string | null;
  phone?: string | null;
  client_id?: string | null;
}) {
  const leads = await listLeads({ status: "open" });
  return (
    leads.find((l) => params.client_id && l.client_id === params.client_id) ??
    leads.find((l) => params.email && l.email === params.email) ??
    leads.find((l) => params.phone && (l.phone === params.phone || l.whatsapp === params.phone)) ??
    null
  );
}

export async function ensureLeadFromInbound(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  wechat?: string | null;
  company?: string | null;
  source: string;
  channel?: Channel | null;
  client_id?: string | null;
  notes?: string | null;
  autoAssign?: boolean;
}) {
  const existing = await findOpenLead({
    email: input.email,
    phone: input.phone ?? input.whatsapp,
    client_id: input.client_id,
  });
  if (existing) {
    if (input.client_id && !existing.client_id) {
      return updateLead(existing.id, { client_id: input.client_id });
    }
    return existing;
  }

  const lead = await createLead({
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    wechat: input.wechat ?? null,
    company: input.company ?? null,
    title: null,
    source: input.source,
    channel: input.channel ?? null,
    status: "new",
    assigned_to: null,
    notes: input.notes ?? null,
    client_id: input.client_id ?? null,
  });

  if (input.autoAssign && input.client_id) {
    await autoAssignWebLead(input.client_id);
    const refreshed = await getLead(lead.id);
    if (refreshed?.client_id) {
      const data = await readCrmData();
      const client = data.clients.find((c) => c.id === refreshed.client_id);
      if (client?.assigned_to) {
        return updateLead(lead.id, { assigned_to: client.assigned_to });
      }
    }
  }

  return lead;
}

export async function listAccounts() {
  const data = await readCrmData();
  return sortNewest(data.accounts ?? []);
}

export async function createAccount(
  input: Omit<CrmAccount, "id" | "created_at" | "updated_at" | "custom_fields"> & {
    custom_fields?: Record<string, string>;
  },
) {
  const data = await readCrmData();
  const now = new Date().toISOString();
  const account: CrmAccount = {
    id: randomUUID(),
    name: input.name.trim(),
    website: input.website ?? null,
    phone: input.phone ?? null,
    industry: input.industry ?? null,
    notes: input.notes ?? null,
    assigned_to: input.assigned_to ?? null,
    custom_fields: input.custom_fields ?? {},
    created_at: now,
    updated_at: now,
  };
  data.accounts = data.accounts ?? [];
  data.accounts.unshift(account);
  await writeCrmData(data);
  return account;
}

export async function updateAccount(id: string, patch: Partial<CrmAccount>) {
  const data = await readCrmData();
  const index = data.accounts?.findIndex((a) => a.id === id) ?? -1;
  if (index === -1 || !data.accounts) return null;

  const current = data.accounts[index];
  const account: CrmAccount = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  };
  data.accounts[index] = account;
  await writeCrmData(data);
  return account;
}

export async function getAccount(id: string) {
  const data = await readCrmData();
  const account = (data.accounts ?? []).find((a) => a.id === id);
  if (!account) return null;
  return { ...account, custom_fields: account.custom_fields ?? {} };
}

export async function getAccountDetail(id: string) {
  const data = await readCrmData();
  const raw = (data.accounts ?? []).find((a) => a.id === id);
  if (!raw) return null;

  const account = { ...raw, custom_fields: raw.custom_fields ?? {} };
  const leads = (data.leads ?? []).filter((l) => l.account_id === id);
  const deals = (data.deals ?? []).filter((d) =>
    leads.some((l) => l.deal_id === d.id),
  );
  const clientIds = new Set([
    ...leads.map((l) => l.client_id).filter(Boolean),
    ...deals.map((d) => d.client_id),
  ] as string[]);
  const contacts = data.clients.filter((c) => clientIds.has(c.id));
  const assigned = account.assigned_to
    ? data.teamMembers.find((m) => m.id === account.assigned_to) ?? null
    : null;

  return {
    account,
    contacts,
    leads: leads.map(normalizeLead),
    deals,
    assigned_name: assigned?.name ?? null,
  };
}

export async function convertLead(
  leadId: string,
  options?: { dealTitle?: string; dealAmount?: number; accountName?: string },
): Promise<ConvertLeadResult | null> {
  const lead = await getLead(leadId);
  if (!lead) return null;

  if (lead.status === "converted" && lead.client_id && lead.deal_id && lead.account_id) {
    return {
      lead,
      client_id: lead.client_id,
      account_id: lead.account_id,
      deal_id: lead.deal_id,
    };
  }

  let clientId = lead.client_id;
  if (!clientId) {
    const client = await createClient({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      wechat: lead.wechat,
      lead_status: "new",
      deposit_amount: 0,
      deposit_currency: "MYR",
      ib_source: lead.source,
      tags: lead.source ? [lead.source] : [],
      assigned_to: lead.assigned_to,
      notes: lead.notes,
      next_follow_up_at: null,
    });
    clientId = client.id;
  }

  const account = await createAccount({
    name: options?.accountName?.trim() || lead.company?.trim() || `${lead.name} Account`,
    website: null,
    phone: lead.phone,
    industry: null,
    notes: lead.notes,
    assigned_to: lead.assigned_to,
  });

  const dealTitle =
    options?.dealTitle?.trim() ||
    (lead.company ? `${lead.company} — ${lead.name}` : `${lead.name} — Opportunity`);

  const deal = await ensureClientDeal(
    clientId,
    lead.name,
    lead.source ?? "lead conversion",
    false,
  );

  const { updateDeal } = await import("@/lib/crm/pro-store");
  await updateDeal(deal.id, {
    title: dealTitle,
    amount: options?.dealAmount ?? deal.amount,
  });

  const now = new Date().toISOString();
  const updated = await updateLead(leadId, {
    status: "converted",
    client_id: clientId,
    account_id: account.id,
    deal_id: deal.id,
    converted_at: now,
  });

  if (!updated) return null;

  await createActivity({
    client_id: clientId,
    deal_id: deal.id,
    type: "status_change",
    title: "Lead converted",
    body: `Lead "${lead.name}" converted to Contact, Account, and Deal`,
    channel: lead.channel,
    actor_name: "CRM",
    metadata: { leadId, accountId: account.id, dealId: deal.id },
  });

  return {
    lead: updated,
    client_id: clientId,
    account_id: account.id,
    deal_id: deal.id,
  };
}

export async function exportLeadsCsv() {
  const { toCsv } = await import("@/lib/crm/csv");
  const leads = await listLeads();
  const headers = ["name", "email", "phone", "whatsapp", "company", "source", "status", "notes"];
  const rows = leads.map((l) =>
    headers.map((h) => {
      if (h === "company") return l.company ?? "";
      if (h === "notes") return l.notes ?? "";
      return String(l[h as keyof CrmLead] ?? "");
    }),
  );
  return toCsv(headers, rows);
}

export async function exportContactsCsv() {
  const { toCsv } = await import("@/lib/crm/csv");
  const data = await readCrmData();
  const headers = [
    "name",
    "email",
    "phone",
    "whatsapp",
    "wechat",
    "lead_status",
    "ib_source",
    "tags",
    "notes",
  ];
  const rows = data.clients.map((c) => [
    c.name,
    c.email ?? "",
    c.phone ?? "",
    c.whatsapp ?? "",
    c.wechat ?? "",
    c.lead_status,
    c.ib_source ?? "",
    c.tags.join("; "),
    c.notes ?? "",
  ]);
  return toCsv(headers, rows);
}

export async function importLeadsFromCsv(csvText: string) {
  const { parseCsv } = await import("@/lib/crm/csv");
  const rows = parseCsv(csvText);
  let imported = 0;
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;
    await createLead({
      name,
      email: row.email || null,
      phone: row.phone || null,
      whatsapp: row.whatsapp || null,
      wechat: row.wechat || null,
      company: row.company || null,
      title: null,
      source: row.source || "csv import",
      channel: null,
      status: (row.status as CrmLeadRecordStatus) || "new",
      assigned_to: null,
      notes: row.notes || null,
    });
    imported++;
  }
  return { imported };
}

export async function importContactsFromCsv(csvText: string) {
  const { parseCsv } = await import("@/lib/crm/csv");
  const rows = parseCsv(csvText);
  let imported = 0;
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;
    await createClient({
      name,
      email: row.email || null,
      phone: row.phone || null,
      whatsapp: row.whatsapp || null,
      wechat: row.wechat || null,
      lead_status: (row.lead_status as import("@/types/database").LeadStatus) || "new",
      deposit_amount: 0,
      deposit_currency: "MYR",
      ib_source: row.ib_source || null,
      tags: row.tags ? row.tags.split(";").map((t) => t.trim()).filter(Boolean) : ["csv import"],
      assigned_to: null,
      notes: row.notes || null,
      next_follow_up_at: null,
    });
    imported++;
  }
  return { imported };
}

export async function getZohoCrmCounts() {
  const [leads, accounts, data] = await Promise.all([
    listLeads(),
    listAccounts(),
    readCrmData(),
  ]);
  return {
    totalLeads: leads.length,
    openLeads: leads.filter((l) => l.status !== "converted" && l.status !== "unqualified").length,
    convertedLeads: leads.filter((l) => l.status === "converted").length,
    totalAccounts: accounts.length,
    totalContacts: data.clients.length,
  };
}
