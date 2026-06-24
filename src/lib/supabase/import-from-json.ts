import "server-only";

import fs from "fs/promises";
import path from "path";
import type { CrmData } from "@/types/crm";
import type { ConversationData } from "@/types/conversation";
import type { InboxSession } from "@/types/inbox";
import { getSupabaseAdmin, IdMapper } from "@/lib/supabase/config";

const DATA_DIR = path.join(process.cwd(), "data");

function sanitizeFollowUpChannel(channel: string) {
  const allowed = new Set(["whatsapp", "wechat", "telegram", "email", "phone"]);
  return allowed.has(channel) ? channel : "phone";
}

async function readJsonFile<T>(name: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, name), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type SupabaseImportResult = {
  ok: true;
  counts: Record<string, number>;
  warnings: string[];
};

export async function testSupabaseConnection() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("clients").select("id", { head: true, count: "exact" });
  if (error) throw new Error(error.message);
  return { connected: true };
}

export async function getSupabaseTableCounts() {
  const supabase = getSupabaseAdmin();
  const tables = [
    "team_members",
    "clients",
    "crm_leads",
    "crm_deals",
    "conversation_messages",
    "inbox_sessions",
  ] as const;

  const counts: Record<string, number | null> = {};
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { head: true, count: "exact" });
    counts[table] = error ? null : count ?? 0;
  }
  return counts;
}

export async function importLocalJsonToSupabase(): Promise<SupabaseImportResult> {
  const supabase = getSupabaseAdmin();
  const ids = new IdMapper();
  const warnings: string[] = [];
  const counts: Record<string, number> = {};

  const crm = await readJsonFile<CrmData>("crm.json");
  const conversations = await readJsonFile<ConversationData>("conversations.json");
  const inboxFile = await readJsonFile<{ sessions: InboxSession[] }>("inbox-sessions.json");
  const settings = await readJsonFile<Record<string, unknown>>("settings.json");

  if (!crm) {
    throw new Error("data/crm.json not found — nothing to import");
  }

  // Pre-resolve IDs for FK consistency
  for (const row of crm.teamMembers ?? []) ids.resolve(row.id);
  for (const row of crm.clients ?? []) ids.resolve(row.id);
  for (const row of crm.leads ?? []) ids.resolve(row.id);
  for (const row of crm.accounts ?? []) ids.resolve(row.id);
  for (const row of crm.deals ?? []) ids.resolve(row.id);
  for (const row of crm.pipelines ?? []) ids.resolve(row.id);
  for (const row of crm.followUps ?? []) ids.resolve(row.id);
  for (const row of crm.tasks ?? []) ids.resolve(row.id);
  for (const row of crm.activities ?? []) ids.resolve(row.id);
  if (conversations?.messages) {
    for (const row of conversations.messages) ids.resolve(row.id);
  }
  if (inboxFile?.sessions) {
    for (const row of inboxFile.sessions) ids.resolve(row.id);
  }

  if (crm.teamMembers?.length) {
    const rows = crm.teamMembers.map((m) => ({
      id: ids.resolve(m.id)!,
      name: m.name,
      email: m.email,
      role: m.role,
      telegram_id: m.telegram_id,
      is_active: m.is_active,
      created_at: m.created_at,
    }));
    const { error } = await supabase.from("team_members").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`team_members: ${error.message}`);
    counts.team_members = rows.length;
  }

  if (crm.clients?.length) {
    const rows = crm.clients.map((c) => ({
      id: ids.resolve(c.id)!,
      name: c.name,
      email: c.email,
      phone: c.phone,
      whatsapp: c.whatsapp,
      wechat: c.wechat,
      lead_status: c.lead_status,
      deposit_amount: c.deposit_amount,
      deposit_currency: c.deposit_currency,
      ib_source: c.ib_source,
      tags: c.tags,
      assigned_to: ids.resolve(c.assigned_to),
      notes: c.notes,
      next_follow_up_at: c.next_follow_up_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
    const { error } = await supabase.from("clients").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`clients: ${error.message}`);
    counts.clients = rows.length;
  }

  if (crm.followUps?.length) {
    const rows = crm.followUps.map((f) => ({
      id: ids.resolve(f.id)!,
      client_id: ids.resolve(f.client_id)!,
      team_member_id: ids.resolve(f.team_member_id),
      channel: sanitizeFollowUpChannel(f.channel),
      summary: f.summary,
      notes: f.notes,
      scheduled_at: f.scheduled_at,
      completed_at: f.completed_at,
      created_at: f.created_at,
    }));
    const { error } = await supabase.from("follow_ups").upsert(rows, { onConflict: "id" });
    if (error) warnings.push(`follow_ups skipped: ${error.message}`);
    else counts.follow_ups = rows.length;
  }

  if (crm.tasks?.length) {
    const rows = crm.tasks.map((t) => ({
      id: ids.resolve(t.id)!,
      title: t.title,
      description: t.description,
      assigned_to: ids.resolve(t.assigned_to),
      status: t.status,
      due_at: t.due_at,
      created_at: t.created_at,
    }));
    const { error } = await supabase.from("team_tasks").upsert(rows, { onConflict: "id" });
    if (error) warnings.push(`team_tasks skipped: ${error.message}`);
    else counts.team_tasks = rows.length;
  }

  if (crm.pipelines?.length) {
    const rows = crm.pipelines.map((p) => ({
      id: ids.resolve(p.id)!,
      name: p.name,
      stages: p.stages,
      is_default: p.is_default,
      created_at: p.created_at,
    }));
    const { error } = await supabase.from("crm_pipelines").upsert(rows, { onConflict: "id" });
    if (error) warnings.push(`crm_pipelines skipped: ${error.message}`);
    else counts.crm_pipelines = rows.length;
  }

  if (crm.deals?.length) {
    const rows = crm.deals.map((d) => ({
      id: ids.resolve(d.id)!,
      client_id: ids.resolve(d.client_id)!,
      pipeline_id: ids.resolve(d.pipeline_id),
      stage_id: d.stage_id,
      title: d.title,
      amount: d.amount,
      currency: d.currency,
      probability: d.probability,
      status: d.status,
      close_date: d.close_date,
      source: d.source,
      notes: d.notes,
      assigned_to: ids.resolve(d.assigned_to),
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));
    const { error } = await supabase.from("crm_deals").upsert(rows, { onConflict: "id" });
    if (error) warnings.push(`crm_deals skipped: ${error.message}`);
    else counts.crm_deals = rows.length;
  }

  if (crm.leads?.length) {
    const rows = crm.leads.map((l) => ({
      id: ids.resolve(l.id)!,
      name: l.name,
      email: l.email,
      phone: l.phone,
      whatsapp: l.whatsapp,
      wechat: l.wechat,
      company: l.company,
      title: l.title,
      source: l.source,
      channel: l.channel,
      status: l.status,
      assigned_to: ids.resolve(l.assigned_to),
      notes: l.notes,
      client_id: ids.resolve(l.client_id),
      account_id: ids.resolve(l.account_id),
      deal_id: ids.resolve(l.deal_id),
      converted_at: l.converted_at,
      custom_fields: l.custom_fields ?? {},
      created_at: l.created_at,
      updated_at: l.updated_at,
    }));
    const { error } = await supabase.from("crm_leads").upsert(rows, { onConflict: "id" });
    if (error) warnings.push(`crm_leads skipped: ${error.message}`);
    else counts.crm_leads = rows.length;
  }

  if (crm.accounts?.length) {
    const rows = crm.accounts.map((a) => ({
      id: ids.resolve(a.id)!,
      name: a.name,
      website: a.website,
      phone: a.phone,
      industry: a.industry,
      notes: a.notes,
      assigned_to: ids.resolve(a.assigned_to),
      custom_fields: a.custom_fields ?? {},
      created_at: a.created_at,
      updated_at: a.updated_at,
    }));
    const { error } = await supabase.from("crm_accounts").upsert(rows, { onConflict: "id" });
    if (error) warnings.push(`crm_accounts skipped: ${error.message}`);
    else counts.crm_accounts = rows.length;
  }

  if (crm.activities?.length) {
    const rows = crm.activities.map((a) => ({
      id: ids.resolve(a.id)!,
      client_id: ids.resolve(a.client_id)!,
      deal_id: ids.resolve(a.deal_id),
      type: a.type,
      title: a.title,
      body: a.body,
      channel: a.channel,
      actor_name: a.actor_name,
      metadata: a.metadata ?? {},
      occurred_at: a.occurred_at,
      created_at: a.created_at,
    }));
    const { error } = await supabase.from("crm_activities").upsert(rows, { onConflict: "id" });
    if (error) warnings.push(`crm_activities skipped: ${error.message}`);
    else counts.crm_activities = rows.length;
  }

  if (conversations?.messages?.length) {
    const rows = conversations.messages.map((m) => ({
      id: ids.resolve(m.id)!,
      client_id: ids.resolve(m.client_id),
      client_name: m.client_name,
      wechat_id: m.wechat_id,
      channel: m.channel,
      direction: m.direction,
      sender_label: m.sender_label,
      content: m.content,
      source: m.source,
      external_id: m.external_id,
      sent_at: m.sent_at,
    }));
    const { error } = await supabase.from("conversation_messages").upsert(rows, {
      onConflict: "id",
    });
    if (error) warnings.push(`conversation_messages skipped: ${error.message}`);
    else counts.conversation_messages = rows.length;
  }

  if (inboxFile?.sessions?.length) {
    const rows = inboxFile.sessions.map((s) => ({
      id: ids.resolve(s.id)!,
      client_id: ids.resolve(s.client_id),
      client_name: s.client_name,
      channel: s.channel,
      status: s.status,
      assigned_to: ids.resolve(s.assigned_to),
      wechat_id: s.wechat_id,
      last_message_at: s.last_message_at,
      last_preview: s.last_preview,
      unread_count: s.unread_count,
      metadata: {
        session_key: s.session_key,
        message_count: s.message_count,
        handoff_at: s.handoff_at,
        closed_at: s.closed_at,
      },
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
    const { error } = await supabase.from("inbox_sessions").upsert(rows, { onConflict: "id" });
    if (error) warnings.push(`inbox_sessions skipped: ${error.message}`);
    else counts.inbox_sessions = rows.length;
  }

  if (settings) {
    const { error } = await supabase.from("app_settings").upsert(
      {
        id: "default",
        payload: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) warnings.push(`app_settings skipped: ${error.message}`);
    else counts.app_settings = 1;
  }

  return { ok: true, counts, warnings };
}
