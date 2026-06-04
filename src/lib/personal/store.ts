import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type {
  JobPriority,
  PersonalData,
  PersonalJob,
  PersonalTodo,
  PlanEntry,
  PlanItem,
  WorkLogEntry,
} from "@/types/personal";

const DATA_DIR = path.join(process.cwd(), "data");
const TODO_PHOTOS_DIR = path.join(DATA_DIR, "todo-photos");
const DATA_FILE = path.join(DATA_DIR, "personal-assistant.json");

const emptyData = (): PersonalData => ({
  jobs: [],
  workLogs: [],
  plans: [],
  todos: [],
});

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(emptyData(), null, 2));
  }
}

function normalizePriority(priority: string): JobPriority {
  if (priority === "high" || priority === "urgent") return "urgent";
  if (priority === "low") return "low";
  return "medium";
}

function migratePriorities(data: PersonalData) {
  for (const todo of data.todos) {
    todo.priority = normalizePriority(todo.priority as string);
  }
  for (const job of data.jobs) {
    job.priority = normalizePriority(job.priority as string);
  }
}

export async function readPersonalData(): Promise<PersonalData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const data = JSON.parse(raw) as PersonalData;
  if (!data.todos) data.todos = [];
  for (const todo of data.todos) {
    if (!todo.photos) todo.photos = [];
  }
  migratePriorities(data);
  return data;
}

async function writePersonalData(data: PersonalData) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function listJobs() {
  const data = await readPersonalData();
  return data.jobs.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function createJob(
  input: Omit<PersonalJob, "id" | "created_at" | "updated_at" | "completed_at">,
) {
  const data = await readPersonalData();
  const now = new Date().toISOString();
  const job: PersonalJob = {
    ...input,
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    completed_at: input.status === "done" ? now : null,
  };
  data.jobs.push(job);
  await writePersonalData(data);
  return job;
}

export async function updateJob(id: string, patch: Partial<PersonalJob>) {
  const data = await readPersonalData();
  const index = data.jobs.findIndex((j) => j.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const current = data.jobs[index];
  const nextStatus = patch.status ?? current.status;
  const job: PersonalJob = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: now,
    completed_at:
      nextStatus === "done"
        ? patch.completed_at ?? current.completed_at ?? now
        : nextStatus === "todo" || nextStatus === "in_progress"
          ? null
          : current.completed_at,
  };
  data.jobs[index] = job;
  await writePersonalData(data);
  return job;
}

export async function deleteJob(id: string) {
  const data = await readPersonalData();
  const before = data.jobs.length;
  data.jobs = data.jobs.filter((j) => j.id !== id);
  if (data.jobs.length === before) return false;
  await writePersonalData(data);
  return true;
}

export async function listWorkLogs() {
  const data = await readPersonalData();
  return data.workLogs.sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
  );
}

export async function createWorkLog(
  input: Omit<WorkLogEntry, "id" | "created_at">,
) {
  const data = await readPersonalData();
  const entry: WorkLogEntry = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  data.workLogs.push(entry);
  await writePersonalData(data);
  return entry;
}

export async function deleteWorkLog(id: string) {
  const data = await readPersonalData();
  const before = data.workLogs.length;
  data.workLogs = data.workLogs.filter((l) => l.id !== id);
  if (data.workLogs.length === before) return false;
  await writePersonalData(data);
  return true;
}

export async function listPlans() {
  const data = await readPersonalData();
  return data.plans.sort(
    (a, b) => new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime(),
  );
}

export async function createPlan(
  input: Omit<PlanEntry, "id" | "created_at" | "updated_at" | "items"> & {
    items?: PlanItem[];
  },
) {
  const data = await readPersonalData();
  const now = new Date().toISOString();
  const plan: PlanEntry = {
    ...input,
    items: input.items ?? [],
    id: randomUUID(),
    created_at: now,
    updated_at: now,
  };
  data.plans.push(plan);
  await writePersonalData(data);
  return plan;
}

export async function updatePlan(id: string, patch: Partial<PlanEntry>) {
  const data = await readPersonalData();
  const index = data.plans.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const current = data.plans[index];
  const plan: PlanEntry = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    items: patch.items ?? current.items,
  };
  data.plans[index] = plan;
  await writePersonalData(data);
  return plan;
}

export async function deletePlan(id: string) {
  const data = await readPersonalData();
  const before = data.plans.length;
  data.plans = data.plans.filter((p) => p.id !== id);
  if (data.plans.length === before) return false;
  await writePersonalData(data);
  return true;
}

export function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

export async function listTodos() {
  const data = await readPersonalData();
  return data.todos.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pri = { urgent: 0, medium: 1, low: 2 };
    const pd = pri[a.priority] - pri[b.priority];
    if (pd !== 0) return pd;
    if (a.due_at && b.due_at) {
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function createTodo(
  input: Omit<PersonalTodo, "id" | "created_at" | "completed_at">,
) {
  const data = await readPersonalData();
  const now = new Date().toISOString();
  const todo: PersonalTodo = {
    ...input,
    id: randomUUID(),
    created_at: now,
    completed_at: input.done ? now : null,
  };
  data.todos.unshift(todo);
  await writePersonalData(data);
  return todo;
}

export async function updateTodo(id: string, patch: Partial<PersonalTodo>) {
  const data = await readPersonalData();
  const index = data.todos.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const current = data.todos[index];
  const done = patch.done ?? current.done;
  const todo: PersonalTodo = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    done,
    completed_at: done ? patch.completed_at ?? current.completed_at ?? now : null,
  };
  data.todos[index] = todo;
  await writePersonalData(data);
  return todo;
}

export async function deleteTodo(id: string) {
  const data = await readPersonalData();
  const todo = data.todos.find((t) => t.id === id);
  if (!todo) return false;

  for (const photo of todo.photos ?? []) {
    await fs.unlink(path.join(TODO_PHOTOS_DIR, photo.filename)).catch(() => undefined);
  }

  data.todos = data.todos.filter((t) => t.id !== id);
  await writePersonalData(data);
  return true;
}
