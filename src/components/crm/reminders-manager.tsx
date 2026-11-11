"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plus, Sparkles } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { TelegramConnect } from "@/components/integrations/telegram-connect";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDateLocalized } from "@/lib/i18n";
import type { Client, Reminder, TeamTask } from "@/types/database";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50";
const btnSmall =
  "rounded-lg border border-card-border px-3 py-1.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40";

export function RemindersManager() {
  const { t, locale } = useLocale();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [remTitle, setRemTitle] = useState("");
  const [remMessage, setRemMessage] = useState("");
  const [remClientId, setRemClientId] = useState("");
  const [remChannel, setRemChannel] = useState<"telegram" | "whatsapp">("telegram");
  const [remAt, setRemAt] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [draftingRem, setDraftingRem] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [remRes, clientRes, taskRes] = await Promise.all([
        fetch("/api/crm/reminders"),
        fetch("/api/clients"),
        fetch("/api/tasks"),
      ]);
      const [remData, clientData, taskData] = await Promise.all([
        remRes.json(),
        clientRes.json(),
        taskRes.json(),
      ]);
      setReminders(remData.reminders ?? []);
      setClients(clientData.clients ?? []);
      setTasks(taskData.tasks ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dueClients = clients.filter((c) => c.next_follow_up_at);
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");

  async function sendWeChatWork(client: Client) {
    const content =
      locale === "zh"
        ? `您好 ${client.name}，这是 AXPM 的跟进提醒。如有任何问题请随时联系我们。`
        : `Hi ${client.name}, this is a follow-up from AXPM. Please let us know if you have any questions.`;
    await fetch("/api/wechat-work/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client.id, content }),
    });
  }

  async function sendFollowUp(client: Client, channel: "telegram" | "email") {
    await fetch("/api/reminders/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        clientName: client.name,
        dueAt: client.next_follow_up_at ?? new Date().toISOString(),
        notes: client.notes,
        clientEmail: client.email,
      }),
    });
  }

  async function scheduleReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!remTitle.trim() || !remMessage.trim() || !remAt) return;
    setSaving(true);
    try {
      await fetch("/api/crm/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: remTitle.trim(),
          message: remMessage.trim(),
          client_id: remClientId || null,
          channel: remChannel,
          scheduled_at: new Date(remAt).toISOString(),
        }),
      });
      setRemTitle("");
      setRemMessage("");
      setRemAt("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim() || null,
          status: "pending",
        }),
      });
      setTaskTitle("");
      setTaskDesc("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function markTaskDone(id: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    load();
  }

  async function draftReminderMessage() {
    const client = clients.find((c) => c.id === remClientId);
    setDraftingRem(true);
    try {
      const res = await fetch("/api/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: remChannel,
          clientName: client?.name ?? t("dashboard.client"),
          customerQuestion: remTitle.trim()
            ? `Write a short follow-up reminder message for: ${remTitle.trim()}`
            : "Write a friendly follow-up reminder for a client we have not heard from recently.",
          clientNotes: client?.notes ?? undefined,
          tone: "friendly",
        }),
      });
      const data = await res.json();
      const draft = data.suggestions?.[0];
      if (draft) setRemMessage(draft);
    } finally {
      setDraftingRem(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("reminders.title")}</h1>
        <p className="mt-1 text-muted">{t("reminders.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="text-center">
          <p className="text-3xl font-bold text-accent">{reminders.length}</p>
          <p className="mt-1 text-sm text-muted">{t("reminders.scheduled")}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-warning">{dueClients.length}</p>
          <p className="mt-1 text-sm text-muted">{t("reminders.clientsDue")}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-foreground">{openTasks.length}</p>
          <p className="mt-1 text-sm text-muted">{t("reminders.openTasks")}</p>
        </Card>
      </div>

      <TelegramConnect />

      <Card>
        <CardHeader title={t("reminders.clientsDueList")} />
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />
        ) : dueClients.length === 0 ? (
          <p className="text-sm text-muted">{t("dashboard.noFollowUps")}</p>
        ) : (
          <div className="space-y-3">
            {dueClients.map((client) => (
              <div key={client.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border bg-background/50 px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{client.name}</p>
                  <p className="text-xs text-muted">
                    {client.next_follow_up_at
                      ? formatDateLocalized(client.next_follow_up_at, locale)
                      : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => sendFollowUp(client, "telegram")} className={btnSmall}>
                    Telegram
                  </button>
                  <button type="button" onClick={() => sendFollowUp(client, "email")} className={btnSmall}>
                    {t("email.sendViaEmail")}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendWeChatWork(client)}
                    disabled={!client.wechat}
                    className={btnSmall}
                  >
                    {t("conversations.workSendBtn")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("reminders.scheduleNew")} description={t("reminders.scheduleNewDesc")} />
          <form onSubmit={scheduleReminder} className="space-y-3">
            <input className={inputClass} placeholder={t("reminders.reminderTitle")} value={remTitle} onChange={(e) => setRemTitle(e.target.value)} />
            <textarea className={inputClass} rows={2} placeholder={t("reminders.reminderMessage")} value={remMessage} onChange={(e) => setRemMessage(e.target.value)} />
            <button
              type="button"
              onClick={draftReminderMessage}
              disabled={draftingRem}
              className={btnSmall}
            >
              {draftingRem ? <Loader2 className="inline h-3 w-3 animate-spin" /> : <Sparkles className="inline h-3 w-3" />}
              {" "}{t("reminders.aiDraft")}
            </button>
            <select className={inputClass} value={remClientId} onChange={(e) => setRemClientId(e.target.value)}>
              <option value="">{t("dashboard.client")} ({t("common.optional")})</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className={inputClass} value={remChannel} onChange={(e) => setRemChannel(e.target.value as "telegram" | "whatsapp")}>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input type="datetime-local" className={inputClass} value={remAt} onChange={(e) => setRemAt(e.target.value)} />
            <button type="submit" disabled={saving || !remTitle.trim() || !remAt} className={btnPrimary}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("reminders.scheduleNew")}
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader title={t("reminders.openTasks")} description={t("reminders.addTask")} />
          <form onSubmit={addTask} className="mb-4 space-y-3">
            <input className={inputClass} placeholder={t("reminders.taskTitle")} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <input className={inputClass} placeholder={t("reminders.taskDesc")} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
            <button type="submit" disabled={saving || !taskTitle.trim()} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              {t("reminders.addTask")}
            </button>
          </form>
          {openTasks.length === 0 ? (
            <p className="text-sm text-muted">{t("reminders.noTasks")}</p>
          ) : (
            <div className="space-y-2">
              {openTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-lg border border-card-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    {task.description && <p className="text-xs text-muted">{task.description}</p>}
                  </div>
                  <button type="button" onClick={() => markTaskDone(task.id)} className={btnSmall}>
                    {t("reminders.markDone")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={t("reminders.scheduledList")} description={t("reminders.scheduledDesc")} />
        {reminders.length === 0 ? (
          <p className="text-sm text-muted">{t("dashboard.noFollowUps")}</p>
        ) : (
          <div className="space-y-3">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-card-border bg-background/50 px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{r.title}</p>
                  <p className="text-xs text-muted">
                    {formatDateLocalized(r.scheduled_at, locale)} · {r.channel}
                  </p>
                </div>
                {r.sent_at ? (
                  <Badge variant="success"><CheckCircle2 className="mr-1 inline h-3 w-3" />{t("common.done")}</Badge>
                ) : (
                  <Badge variant="warning">{t("dashboard.scheduled")}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
