"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VoiceInput, VoiceTextarea } from "@/components/ui/voice-field";
import { formatDateLocalized } from "@/lib/i18n";
import type {
  JobPriority,
  JobStatus,
  PersonalJob,
  PlanEntry,
  PlanPeriod,
  WorkLogEntry,
} from "@/types/personal";

type Tab = "jobs" | "logs" | "plans";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted transition-colors disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/50 transition-colors";

const priorityVariant: Record<JobPriority, "muted" | "default" | "warning" | "danger"> = {
  low: "muted",
  medium: "default",
  urgent: "danger",
};

const statusVariant: Record<JobStatus, "muted" | "default" | "success" | "danger"> = {
  todo: "muted",
  in_progress: "default",
  done: "success",
  cancelled: "danger",
};

function todayString() {
  return new Date().toISOString().split("T")[0];
}

export function MyAssistant() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("jobs");
  const [jobs, setJobs] = useState<PersonalJob[]>([]);
  const [logs, setLogs] = useState<WorkLogEntry[]>([]);
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingSummary, setSendingSummary] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, logsRes, plansRes] = await Promise.all([
        fetch("/api/personal/jobs"),
        fetch("/api/personal/logs"),
        fetch("/api/personal/plans"),
      ]);
      const [jobsData, logsData, plansData] = await Promise.all([
        jobsRes.json(),
        logsRes.json(),
        plansRes.json(),
      ]);
      setJobs(jobsData.jobs ?? []);
      setLogs(logsData.logs ?? []);
      setPlans(plansData.plans ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function sendDailySummary() {
    setSendingSummary(true);
    try {
      await fetch("/api/personal/summary", { method: "POST" });
    } finally {
      setSendingSummary(false);
    }
  }

  const pendingJobs = jobs.filter((j) => j.status === "todo" || j.status === "in_progress");
  const doneJobs = jobs.filter((j) => j.status === "done");
  const todayPlan = plans.find((p) => p.period === "daily" && p.plan_date === todayString());

  const tabs: { id: Tab; label: string; icon: typeof Briefcase }[] = [
    { id: "jobs", label: t("assistant.tabJobs"), icon: Briefcase },
    { id: "logs", label: t("assistant.tabLogs"), icon: ClipboardList },
    { id: "plans", label: t("assistant.tabPlanning"), icon: CalendarDays },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("assistant.title")}</h1>
          <p className="mt-1 text-muted">{t("assistant.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={sendDailySummary}
          disabled={sendingSummary}
          className={btnPrimary}
        >
          {sendingSummary ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {t("assistant.sendSummary")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-accent">{pendingJobs.length}</p>
          <p className="mt-1 text-sm text-muted">{t("assistant.pendingJobs")}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success">{doneJobs.length}</p>
          <p className="mt-1 text-sm text-muted">{t("assistant.completed")}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-foreground">{logs.length}</p>
          <p className="mt-1 text-sm text-muted">{t("assistant.workLogs")}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-warning">
            {todayPlan
              ? `${todayPlan.items.filter((i) => i.done).length}/${todayPlan.items.length}`
              : "—"}
          </p>
          <p className="mt-1 text-sm text-muted">{t("assistant.todaysPlan")}</p>
        </Card>
      </div>

      <div className="flex gap-1 rounded-lg border border-card-border bg-card p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <>
          {tab === "jobs" && <JobsPanel jobs={jobs} onChange={loadAll} />}
          {tab === "logs" && <LogsPanel logs={logs} onChange={loadAll} />}
          {tab === "plans" && <PlansPanel plans={plans} onChange={loadAll} />}
        </>
      )}
    </div>
  );
}

function JobsPanel({
  jobs,
  onChange,
}: {
  jobs: PersonalJob[];
  onChange: () => void;
}) {
  const { t, locale } = useLocale();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("work");
  const [priority, setPriority] = useState<JobPriority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/personal/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          priority,
          due_at: dueAt || null,
        }),
      });
      setTitle("");
      setDescription("");
      setDueAt("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: JobStatus) {
    await fetch(`/api/personal/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onChange();
  }

  async function deleteJob(id: string) {
    await fetch(`/api/personal/jobs/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title={t("assistant.addJob")} description={t("assistant.addJobDesc")} />
        <form onSubmit={handleAdd} className="space-y-3">
          <VoiceInput
            className={inputClass}
            placeholder={t("assistant.jobTitle")}
            value={title}
            onValueChange={setTitle}
          />
          <VoiceTextarea
            className={`${inputClass} min-h-[72px] resize-y`}
            placeholder={t("assistant.description")}
            value={description}
            onValueChange={setDescription}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {(["work", "client", "admin", "personal", "planning"] as const).map((c) => (
                <option key={c} value={c}>
                  {t(`assistant.categories.${c}`)}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value as JobPriority)}
            >
              <option value="low">{t("assistant.priority.low")}</option>
              <option value="medium">{t("assistant.priority.medium")}</option>
              <option value="urgent">{t("assistant.priority.urgent")}</option>
            </select>
          </div>
          <input
            type="date"
            className={inputClass}
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
          <button type="submit" disabled={saving || !title.trim()} className={`${btnPrimary} w-full justify-center`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("assistant.addJobBtn")}
          </button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title={t("assistant.allJobs")}
          description={`${t("common.total", { count: jobs.length })} · ${t("common.active", { count: jobs.filter((j) => j.status !== "done" && j.status !== "cancelled").length })}`}
        />
        {jobs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("assistant.noJobs")}</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border border-card-border bg-background/50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`font-medium ${job.status === "done" ? "text-muted line-through" : "text-foreground"}`}>
                        {job.title}
                      </p>
                      <Badge variant={priorityVariant[job.priority]}>{job.priority}</Badge>
                      <Badge variant={statusVariant[job.status]}>
                        {t(`assistant.status.${job.status}`)}
                      </Badge>
                      <Badge variant="muted">
                        {t(`assistant.categories.${job.category as "work"}`)}
                      </Badge>
                    </div>
                    {job.description && (
                      <p className="mt-1 text-sm text-muted">{job.description}</p>
                    )}
                    {job.due_at && (
                      <p className="mt-1 text-xs text-muted">
                        {t("common.due")}: {formatDateLocalized(job.due_at, locale)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {job.status !== "done" && (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => updateStatus(job.id, job.status === "todo" ? "in_progress" : "done")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {job.status === "todo" ? t("common.start") : t("common.done")}
                      </button>
                    )}
                    {job.status === "done" && (
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => updateStatus(job.id, "todo")}
                      >
                        {t("common.reopen")}
                      </button>
                    )}
                    <button type="button" className={btnGhost} onClick={() => deleteJob(job.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LogsPanel({
  logs,
  onChange,
}: {
  logs: WorkLogEntry[];
  onChange: () => void;
}) {
  const { t, locale } = useLocale();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("work");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/personal/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category,
          duration_minutes: duration ? Number(duration) : null,
        }),
      });
      setTitle("");
      setContent("");
      setDuration("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(id: string) {
    await fetch(`/api/personal/logs/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title={t("assistant.logWork")} description={t("assistant.logWorkDesc")} />
        <form onSubmit={handleAdd} className="space-y-3">
          <VoiceInput
            className={inputClass}
            placeholder={t("assistant.whatDidYouDo")}
            value={title}
            onValueChange={setTitle}
          />
          <VoiceTextarea
            className={`${inputClass} min-h-[96px] resize-y`}
            placeholder={t("assistant.logDetails")}
            value={content}
            onValueChange={setContent}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {(["work", "client", "meeting", "admin", "learning"] as const).map((c) => (
                <option key={c} value={c}>
                  {t(`assistant.categories.${c}`)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder={t("assistant.minutes")}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <button type="submit" disabled={saving || !title.trim()} className={`${btnPrimary} w-full justify-center`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("assistant.saveLog")}
          </button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title={t("assistant.workHistory")} description="" />
        {logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("assistant.noLogs")}</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-card-border bg-background/50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{log.title}</p>
                      <Badge variant="muted">
                        {t(`assistant.categories.${log.category as "work"}`)}
                      </Badge>
                      {log.duration_minutes && (
                        <span className="text-xs text-muted">
                          {log.duration_minutes} {t("assistant.minutes")}
                        </span>
                      )}
                    </div>
                    {log.content && (
                      <p className="mt-1 text-sm text-muted">{log.content}</p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {formatDateLocalized(log.logged_at, locale)}
                    </p>
                  </div>
                  <button type="button" className={btnGhost} onClick={() => deleteLog(log.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PlansPanel({
  plans,
  onChange,
}: {
  plans: PlanEntry[];
  onChange: () => void;
}) {
  const { t, locale } = useLocale();
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState<PlanPeriod>("daily");
  const [planDate, setPlanDate] = useState(todayString());
  const [notes, setNotes] = useState("");
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/personal/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          period,
          plan_date: planDate,
          notes: notes.trim() || null,
          items: [],
        }),
      });
      setTitle("");
      setNotes("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(plan: PlanEntry, itemId: string) {
    const items = plan.items.map((i) =>
      i.id === itemId ? { ...i, done: !i.done } : i,
    );
    await fetch(`/api/personal/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    onChange();
  }

  async function addItemToPlan(plan: PlanEntry) {
    if (!newItem.trim()) return;
    const items = [
      ...plan.items,
      { id: crypto.randomUUID(), text: newItem.trim(), done: false },
    ];
    await fetch(`/api/personal/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setNewItem("");
    onChange();
  }

  async function deletePlan(id: string) {
    await fetch(`/api/personal/plans/${id}`, { method: "DELETE" });
    onChange();
  }

  const todayPlans = plans.filter((p) => p.plan_date === todayString());

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title={t("assistant.newPlan")} description={t("assistant.newPlanDesc")} />
        <form onSubmit={handleAddPlan} className="space-y-3">
          <input
            className={inputClass}
            placeholder={t("assistant.planTitle")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              className={inputClass}
              value={period}
              onChange={(e) => setPeriod(e.target.value as PlanPeriod)}
            >
              <option value="daily">{t("assistant.daily")}</option>
              <option value="weekly">{t("assistant.weekly")}</option>
            </select>
            <input
              type="date"
              className={inputClass}
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
            />
          </div>
          <VoiceTextarea
            className={`${inputClass} min-h-[72px] resize-y`}
            placeholder={t("assistant.planGoals")}
            value={notes}
            onValueChange={setNotes}
          />
          <button type="submit" disabled={saving || !title.trim()} className={`${btnPrimary} w-full justify-center`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("assistant.createPlan")}
          </button>
        </form>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        {todayPlans.length > 0 && (
          <Card>
            <CardHeader
              title={t("assistant.todaysPlans")}
              description={formatDateLocalized(todayString(), locale)}
            />
            <div className="space-y-4">
              {todayPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  newItem={newItem}
                  setNewItem={setNewItem}
                  onToggle={toggleItem}
                  onAddItem={addItemToPlan}
                  onDelete={deletePlan}
                />
              ))}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader
            title={t("assistant.allPlans")}
            description={t("common.records", { count: plans.length })}
          />
          {plans.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{t("assistant.noPlans")}</p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  newItem={newItem}
                  setNewItem={setNewItem}
                  onToggle={toggleItem}
                  onAddItem={addItemToPlan}
                  onDelete={deletePlan}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  newItem,
  setNewItem,
  onToggle,
  onAddItem,
  onDelete,
}: {
  plan: PlanEntry;
  newItem: string;
  setNewItem: (v: string) => void;
  onToggle: (plan: PlanEntry, itemId: string) => void;
  onAddItem: (plan: PlanEntry) => void;
  onDelete: (id: string) => void;
}) {
  const { t, locale } = useLocale();
  const done = plan.items.filter((i) => i.done).length;

  return (
    <div className="rounded-lg border border-card-border bg-background/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{plan.title}</p>
            <Badge variant="default">
              {plan.period === "daily" ? t("assistant.daily") : t("assistant.weekly")}
            </Badge>
            <span className="text-xs text-muted">
              {formatDateLocalized(plan.plan_date, locale)} · {done}/{plan.items.length}
            </span>
          </div>
          {plan.notes && <p className="mt-1 text-sm text-muted">{plan.notes}</p>}
        </div>
        <button type="button" className={btnGhost} onClick={() => onDelete(plan.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {plan.items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggle(plan, item.id)}
              className="text-accent hover:text-accent-muted"
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </button>
            <span className={`text-sm ${item.done ? "text-muted line-through" : "text-foreground"}`}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <VoiceInput
          className={`${inputClass} flex-1`}
          placeholder={t("assistant.addChecklist")}
          value={newItem}
          onValueChange={setNewItem}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddItem(plan);
            }
          }}
        />
        <button type="button" className={btnGhost} onClick={() => onAddItem(plan)}>
          <Plus className="h-3.5 w-3.5" />
          {t("common.add")}
        </button>
      </div>
    </div>
  );
}
