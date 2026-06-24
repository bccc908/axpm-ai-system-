import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  mockClients,
  mockDailyReport,
  mockFollowUps,
  mockTasks,
  mockTeamMembers,
} from "@/lib/mock-data";
import type { CrmData, CrmOverview } from "@/types/crm";
import type { Client, DailyReport, FollowUp, Reminder, TeamTask } from "@/types/database";
import { buildDefaultPipeline } from "@/lib/crm/pipelines-default";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "crm.json");

function seedData(): CrmData {
  return {
    clients: mockClients,
    followUps: mockFollowUps,
    teamMembers: mockTeamMembers,
    tasks: mockTasks,
    reminders: [],
    conversationSummaries: [],
    dailyReports: [mockDailyReport],
    activities: [],
    deals: [],
    pipelines: [buildDefaultPipeline()],
    leads: [],
    accounts: [],
  };
}

function migrateCrmData(raw: Partial<CrmData>): CrmData {
  const seed = seedData();
  return {
    clients: raw.clients ?? seed.clients,
    followUps: raw.followUps ?? seed.followUps,
    teamMembers: raw.teamMembers ?? seed.teamMembers,
    tasks: raw.tasks ?? seed.tasks,
    reminders: raw.reminders ?? seed.reminders,
    conversationSummaries: raw.conversationSummaries ?? seed.conversationSummaries,
    dailyReports: raw.dailyReports ?? seed.dailyReports,
    activities: raw.activities ?? seed.activities,
    deals: raw.deals ?? seed.deals,
    pipelines: raw.pipelines?.length ? raw.pipelines : seed.pipelines,
    leads: raw.leads ?? seed.leads,
    accounts: raw.accounts ?? seed.accounts,
  };
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(seedData(), null, 2));
  }
}

export async function readCrmData(): Promise<CrmData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return migrateCrmData(JSON.parse(raw) as Partial<CrmData>);
}

export async function writeCrmData(data: CrmData) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function listClients() {
  const data = await readCrmData();
  return data.clients.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function createClient(
  input: Omit<Client, "id" | "created_at" | "updated_at">,
) {
  const data = await readCrmData();
  const now = new Date().toISOString();
  const client: Client = {
    ...input,
    id: randomUUID(),
    created_at: now,
    updated_at: now,
  };
  data.clients.push(client);
  await writeCrmData(data);
  return client;
}

export async function updateClient(id: string, patch: Partial<Client>) {
  const data = await readCrmData();
  const index = data.clients.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const current = data.clients[index];
  const client: Client = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  };
  data.clients[index] = client;
  await writeCrmData(data);
  return client;
}

export async function deleteClient(id: string) {
  const data = await readCrmData();
  const before = data.clients.length;
  data.clients = data.clients.filter((c) => c.id !== id);
  data.followUps = data.followUps.filter((f) => f.client_id !== id);
  data.deals = (data.deals ?? []).filter((d) => d.client_id !== id);
  data.activities = (data.activities ?? []).filter((a) => a.client_id !== id);
  if (data.clients.length === before) return false;
  await writeCrmData(data);
  return true;
}

export async function listFollowUps() {
  const data = await readCrmData();
  return data.followUps.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function createFollowUp(
  input: Omit<FollowUp, "id" | "created_at">,
) {
  const data = await readCrmData();
  const followUp: FollowUp = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  data.followUps.unshift(followUp);
  await writeCrmData(data);
  return followUp;
}

export async function listTeamMembers() {
  const data = await readCrmData();
  return data.teamMembers;
}

export async function listTasks(filters?: { client_id?: string; deal_id?: string }) {
  const data = await readCrmData();
  let tasks = [...data.tasks];
  if (filters?.client_id) tasks = tasks.filter((t) => t.client_id === filters.client_id);
  if (filters?.deal_id) tasks = tasks.filter((t) => t.deal_id === filters.deal_id);
  return tasks.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function createTask(input: Omit<TeamTask, "id" | "created_at">) {
  const data = await readCrmData();
  const task: TeamTask = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  data.tasks.unshift(task);
  await writeCrmData(data);
  return task;
}

export async function updateTask(id: string, patch: Partial<TeamTask>) {
  const data = await readCrmData();
  const index = data.tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const current = data.tasks[index];
  const task: TeamTask = { ...current, ...patch, id: current.id, created_at: current.created_at };
  data.tasks[index] = task;
  await writeCrmData(data);
  return task;
}

export async function deleteTask(id: string) {
  const data = await readCrmData();
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  if (data.tasks.length === before) return false;
  await writeCrmData(data);
  return true;
}

export async function listReminders() {
  const data = await readCrmData();
  return data.reminders.sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );
}

export async function createReminder(input: Omit<Reminder, "id" | "created_at" | "sent_at">) {
  const data = await readCrmData();
  const reminder: Reminder = {
    ...input,
    id: randomUUID(),
    sent_at: null,
    created_at: new Date().toISOString(),
  };
  data.reminders.push(reminder);
  await writeCrmData(data);
  return reminder;
}

export async function markReminderSent(id: string) {
  const data = await readCrmData();
  const index = data.reminders.findIndex((r) => r.id === id);
  if (index === -1) return null;
  data.reminders[index] = {
    ...data.reminders[index],
    sent_at: new Date().toISOString(),
  };
  await writeCrmData(data);
  return data.reminders[index];
}

export async function saveDailyReport(report: Omit<DailyReport, "id" | "created_at">) {
  const data = await readCrmData();
  const entry: DailyReport = {
    ...report,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  data.dailyReports.unshift(entry);
  await writeCrmData(data);
  return entry;
}

export async function getLatestDailyReport() {
  const data = await readCrmData();
  return data.dailyReports[0] ?? null;
}

export async function getCrmOverview(): Promise<CrmOverview> {
  const data = await readCrmData();
  const today = new Date().toDateString();

  const clientsDueToday = data.clients.filter((c) => {
    if (!c.next_follow_up_at) return false;
    return new Date(c.next_follow_up_at).toDateString() === today;
  });

  const totalDeposits = data.clients.reduce((sum, c) => sum + c.deposit_amount, 0);

  return {
    totalClients: data.clients.length,
    followUpsDueToday: clientsDueToday.length,
    totalDeposits,
    pendingTasks: data.tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length,
    clientsDueToday,
    recentFollowUps: data.followUps.slice(0, 10),
    latestDailyReport: data.dailyReports[0] ?? null,
  };
}

export async function getClientsForAi() {
  const clients = await listClients();
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    whatsapp: c.whatsapp,
    wechat: c.wechat,
    lead_status: c.lead_status,
    deposit_amount: c.deposit_amount,
    notes: c.notes,
    tags: c.tags,
  }));
}
