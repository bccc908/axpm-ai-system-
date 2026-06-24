import "server-only";

import { randomUUID } from "crypto";
import type { Channel, LeadStatus } from "@/types/database";
import type {
  ActivityType,
  CrmActivity,
  CrmBoardColumn,
  CrmDeal,
  CrmTimelineItem,
  DealStatus,
} from "@/types/crm-pro";
import { readCrmData, writeCrmData, listClients, updateClient } from "@/lib/crm/store";
import { listMessages } from "@/lib/conversations/store";
import { buildDefaultPipeline, DEFAULT_PIPELINE_ID, STAGE_TO_LEAD_STATUS } from "@/lib/crm/pipelines-default";
import { autoAssignWebLead } from "@/lib/crm/assignment";

async function ensureProData() {
  const data = await readCrmData();
  let changed = false;

  if (!data.pipelines?.length) {
    data.pipelines = [buildDefaultPipeline()];
    changed = true;
  }
  if (!data.activities) {
    data.activities = [];
    changed = true;
  }
  if (!data.deals) {
    data.deals = [];
    changed = true;
  }

  if (changed) await writeCrmData(data);
  return data;
}

export async function listPipelines() {
  const data = await ensureProData();
  return data.pipelines;
}

export async function getDefaultPipeline() {
  const pipelines = await listPipelines();
  return pipelines.find((p) => p.is_default) ?? pipelines[0];
}

export async function listDeals(filters?: {
  client_id?: string;
  pipeline_id?: string;
  status?: DealStatus;
}) {
  const data = await ensureProData();
  let deals = [...data.deals];
  if (filters?.client_id) deals = deals.filter((d) => d.client_id === filters.client_id);
  if (filters?.pipeline_id) deals = deals.filter((d) => d.pipeline_id === filters.pipeline_id);
  if (filters?.status) deals = deals.filter((d) => d.status === filters.status);
  return deals.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function createDeal(input: {
  client_id: string;
  title: string;
  amount?: number;
  currency?: string;
  source?: string | null;
  stage_id?: string;
  assigned_to?: string | null;
  notes?: string | null;
}) {
  const data = await ensureProData();
  const pipeline = data.pipelines.find((p) => p.is_default) ?? data.pipelines[0];
  const stageId = input.stage_id ?? pipeline?.stages[0]?.id ?? "stage-new";
  const stage = pipeline?.stages.find((s) => s.id === stageId);
  const now = new Date().toISOString();

  const deal: CrmDeal = {
    id: randomUUID(),
    client_id: input.client_id,
    pipeline_id: pipeline?.id ?? DEFAULT_PIPELINE_ID,
    stage_id: stageId,
    title: input.title.trim(),
    amount: input.amount ?? 0,
    currency: input.currency ?? "MYR",
    probability: stage?.probability ?? 10,
    status: "open",
    close_date: null,
    source: input.source ?? null,
    notes: input.notes ?? null,
    assigned_to: input.assigned_to ?? null,
    created_at: now,
    updated_at: now,
  };

  data.deals.unshift(deal);
  await writeCrmData(data);

  await createActivity({
    client_id: deal.client_id,
    deal_id: deal.id,
    type: "deal_update",
    title: `Deal created: ${deal.title}`,
    body: deal.notes,
    metadata: { stage_id: deal.stage_id, amount: deal.amount },
  });

  return deal;
}

export async function updateDeal(
  id: string,
  patch: Partial<
    Pick<
      CrmDeal,
      | "title"
      | "amount"
      | "currency"
      | "probability"
      | "status"
      | "close_date"
      | "stage_id"
      | "notes"
      | "assigned_to"
    >
  >,
) {
  const data = await ensureProData();
  const index = data.deals.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const current = data.deals[index];
  const pipeline = data.pipelines.find((p) => p.id === current.pipeline_id);
  const nextStage = patch.stage_id
    ? pipeline?.stages.find((s) => s.id === patch.stage_id)
    : undefined;

  const deal: CrmDeal = {
    ...current,
    ...patch,
    probability: nextStage?.probability ?? patch.probability ?? current.probability,
    updated_at: new Date().toISOString(),
  };
  data.deals[index] = deal;
  await writeCrmData(data);

  if (patch.stage_id && patch.stage_id !== current.stage_id) {
    const stageName = nextStage?.name ?? patch.stage_id;
    await createActivity({
      client_id: deal.client_id,
      deal_id: deal.id,
      type: "deal_update",
      title: `Moved to ${stageName}`,
      body: deal.notes,
      metadata: { stage_id: deal.stage_id },
    });

    const leadStatus = STAGE_TO_LEAD_STATUS[deal.stage_id] as LeadStatus | undefined;
    if (leadStatus) {
      await updateClient(deal.client_id, { lead_status: leadStatus });
    }

    const { runDealStageWorkflows } = await import("@/lib/crm/workflows");
    await runDealStageWorkflows(deal, current.stage_id, patch.stage_id);
  }

  if (patch.status && patch.status !== current.status) {
    await createActivity({
      client_id: deal.client_id,
      deal_id: deal.id,
      type: "deal_update",
      title: `Deal marked ${patch.status}`,
      body: deal.notes,
      metadata: { status: patch.status },
    });
  }

  return deal;
}

export async function listActivities(filters?: { client_id?: string; deal_id?: string; limit?: number }) {
  const data = await ensureProData();
  let items = [...data.activities];
  if (filters?.client_id) items = items.filter((a) => a.client_id === filters.client_id);
  if (filters?.deal_id) items = items.filter((a) => a.deal_id === filters.deal_id);
  items.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  if (filters?.limit) items = items.slice(0, filters.limit);
  return items;
}

export async function createActivity(input: {
  client_id: string;
  deal_id?: string | null;
  type: ActivityType;
  title: string;
  body?: string | null;
  channel?: Channel | null;
  actor_name?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  occurred_at?: string;
}) {
  const data = await ensureProData();
  const now = new Date().toISOString();
  const activity: CrmActivity = {
    id: randomUUID(),
    client_id: input.client_id,
    deal_id: input.deal_id ?? null,
    type: input.type,
    title: input.title.trim(),
    body: input.body?.trim() || null,
    channel: input.channel ?? null,
    actor_name: input.actor_name ?? null,
    metadata: input.metadata ?? {},
    occurred_at: input.occurred_at ?? now,
    created_at: now,
  };
  data.activities.unshift(activity);

  const clientIndex = data.clients.findIndex((c) => c.id === input.client_id);
  if (clientIndex >= 0) {
    data.clients[clientIndex] = {
      ...data.clients[clientIndex],
      updated_at: now,
    };
  }

  await writeCrmData(data);
  return activity;
}

export async function ensureClientDeal(
  clientId: string,
  clientName: string,
  source?: string | null,
  autoAssign = false,
) {
  const deals = await listDeals({ client_id: clientId, status: "open" });
  if (deals.length > 0) return deals[0];

  if (autoAssign) {
    await autoAssignWebLead(clientId);
  }

  const data = await ensureProData();
  const client = data.clients.find((c) => c.id === clientId);

  return createDeal({
    client_id: clientId,
    title: `${clientName} — New opportunity`,
    source: source ?? "website",
    stage_id: "stage-new",
    assigned_to: client?.assigned_to ?? null,
  });
}

export async function getPipelineBoard(pipelineId?: string) {
  const data = await ensureProData();
  const clients = await listClients();
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const pipeline =
    data.pipelines.find((p) => p.id === pipelineId) ??
    data.pipelines.find((p) => p.is_default) ??
    data.pipelines[0];

  if (!pipeline) return { pipeline: null, columns: [] as CrmBoardColumn[] };

  const openDeals = data.deals.filter(
    (d) => d.pipeline_id === pipeline.id && d.status === "open",
  );

  const columns: CrmBoardColumn[] = [...pipeline.stages]
    .sort((a, b) => a.order - b.order)
    .map((stage) => ({
      stage,
      deals: openDeals
        .filter((d) => d.stage_id === stage.id)
        .map((d) => ({
          ...d,
          client_name: clientMap.get(d.client_id) ?? "Unknown",
        })),
    }));

  return { pipeline, columns };
}

export async function getClientTimeline(clientId: string, limit = 50): Promise<CrmTimelineItem[]> {
  const [activities, messages, data] = await Promise.all([
    listActivities({ client_id: clientId, limit: 100 }),
    listMessages({ client_id: clientId, limit: 100 }),
    ensureProData(),
  ]);

  const followUps = data.followUps.filter((f) => f.client_id === clientId);

  const items: CrmTimelineItem[] = [
    ...activities.map((a) => ({
      id: a.id,
      kind: "activity" as const,
      type: a.type,
      title: a.title,
      body: a.body,
      channel: a.channel,
      actor_name: a.actor_name,
      occurred_at: a.occurred_at,
    })),
    ...messages.map((m) => ({
      id: m.id,
      kind: "message" as const,
      type: m.direction === "inbound" ? "inbound_message" : "outbound_message",
      title: m.direction === "inbound" ? `${m.sender_label} sent a message` : "Reply sent",
      body: m.content,
      channel: m.channel,
      actor_name: m.sender_label,
      occurred_at: m.sent_at,
    })),
    ...followUps.map((f) => ({
      id: f.id,
      kind: "follow_up" as const,
      type: "follow_up",
      title: f.summary?.trim() || "Follow-up logged",
      body: f.notes,
      channel: f.channel,
      actor_name: null,
      occurred_at: f.completed_at ?? f.scheduled_at ?? f.created_at,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, limit);
}

export async function getCrmProStats() {
  const data = await ensureProData();
  const openDeals = data.deals.filter((d) => d.status === "open");
  const wonDeals = data.deals.filter((d) => d.status === "won");
  const webClients = data.clients.filter(
    (c) => c.tags.includes("website") || c.tags.includes("widget"),
  );

  return {
    totalContacts: data.clients.length,
    openDeals: openDeals.length,
    pipelineValue: openDeals.reduce((sum, d) => sum + d.amount, 0),
    wonDeals: wonDeals.length,
    wonValue: wonDeals.reduce((sum, d) => sum + d.amount, 0),
    webLeads: webClients.length,
    activitiesToday: data.activities.filter((a) => {
      const d = new Date(a.occurred_at);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }).length,
  };
}

export async function getCrmReports() {
  const data = await ensureProData();
  const pipeline = data.pipelines.find((p) => p.is_default) ?? data.pipelines[0];
  const allDeals = data.deals;
  const openDeals = allDeals.filter((d) => d.status === "open");
  const wonDeals = allDeals.filter((d) => d.status === "won");
  const lostDeals = allDeals.filter((d) => d.status === "lost");
  const closed = wonDeals.length + lostDeals.length;

  const funnel = (pipeline?.stages ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const stageDeals = allDeals.filter((d) => d.stage_id === stage.id);
      return {
        stage_id: stage.id,
        name: stage.name,
        color: stage.color,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + d.amount, 0),
      };
    });

  const weightedForecast = openDeals.reduce(
    (sum, d) => sum + d.amount * (d.probability / 100),
    0,
  );

  return {
    conversionRate: closed > 0 ? Math.round((wonDeals.length / closed) * 100) : 0,
    winRate: allDeals.length > 0 ? Math.round((wonDeals.length / allDeals.length) * 100) : 0,
    wonCount: wonDeals.length,
    lostCount: lostDeals.length,
    openCount: openDeals.length,
    wonValue: wonDeals.reduce((sum, d) => sum + d.amount, 0),
    pipelineValue: openDeals.reduce((sum, d) => sum + d.amount, 0),
    weightedForecast,
    funnel,
  };
}
