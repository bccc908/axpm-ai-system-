"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  Loader2,
  Plus,
  TrendingUp,
  User,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { CrmSendEmail } from "@/components/crm/crm-send-email";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { CrmDeal, CrmTimelineItem } from "@/types/crm-pro";
import type { Client, TeamTask } from "@/types/database";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export function ContactDetail({ clientId }: { clientId: string }) {
  const { t, locale } = useLocale();
  const [client, setClient] = useState<Client | null>(null);
  const [timeline, setTimeline] = useState<CrmTimelineItem[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [timelineRes, tasksRes] = await Promise.all([
        fetch(`/api/crm/contacts/${clientId}/timeline`),
        fetch(`/api/tasks?client_id=${clientId}`),
      ]);
      const data = await timelineRes.json();
      const tasksData = await tasksRes.json();
      if (timelineRes.ok) {
        setClient(data.client);
        setTimeline(data.timeline ?? []);
        setDeals(data.deals ?? []);
      }
      setTasks(tasksData.tasks ?? []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addNote() {
    if (!noteTitle.trim()) return;
    setSavingNote(true);
    try {
      await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          type: "note",
          title: noteTitle.trim(),
          body: noteBody.trim() || null,
        }),
      });
      setNoteTitle("");
      setNoteBody("");
      await load();
    } finally {
      setSavingNote(false);
    }
  }

  async function addTask() {
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const openDeal = deals.find((d) => d.status === "open");
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          client_id: clientId,
          deal_id: openDeal?.id ?? null,
          due_at: taskDue ? new Date(taskDue).toISOString() : null,
          assigned_to: client?.assigned_to ?? null,
        }),
      });
      setTaskTitle("");
      setTaskDue("");
      await load();
    } finally {
      setSavingTask(false);
    }
  }

  async function completeTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!client) {
    return <p className="text-muted">{t("crmPro.contactNotFound")}</p>;
  }

  const openDeal = deals.find((d) => d.status === "open");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/crm"
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("crmPro.backToCrm")}
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
              <User className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="default">{client.lead_status}</Badge>
                {client.tags.map((tag) => (
                  <Badge key={tag} variant="muted">
                    {tag}
                  </Badge>
                ))}
                {client.tags.includes("widget") && (
                  <Badge variant="default">
                    <Globe className="mr-1 h-3 w-3 inline" />
                    Web
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Link
          href={`/dashboard/conversations?client=${client.id}`}
          className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent"
        >
          {t("crmPro.openConversations")}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader title={t("crmPro.contactInfo")} />
            <dl className="space-y-3 text-sm">
              {client.email && (
                <div>
                  <dt className="text-muted">Email</dt>
                  <dd>{client.email}</dd>
                </div>
              )}
              {client.phone && (
                <div>
                  <dt className="text-muted">Phone</dt>
                  <dd>{client.phone}</dd>
                </div>
              )}
              {client.whatsapp && (
                <div>
                  <dt className="text-muted">WhatsApp</dt>
                  <dd>{client.whatsapp}</dd>
                </div>
              )}
              {client.wechat && (
                <div>
                  <dt className="text-muted">WeChat</dt>
                  <dd>{client.wechat}</dd>
                </div>
              )}
              {client.ib_source && (
                <div>
                  <dt className="text-muted">IB Source</dt>
                  <dd>{client.ib_source}</dd>
                </div>
              )}
              {client.notes && (
                <div>
                  <dt className="text-muted">{t("crmPro.notes")}</dt>
                  <dd className="whitespace-pre-wrap">{client.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title={t("crmPro.dealTitle")}
              description={t("crmPro.dealDesc")}
            />
            {openDeal ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  {openDeal.title}
                </div>
                <p>{formatCurrency(openDeal.amount, openDeal.currency)}</p>
                <p className="text-muted">{openDeal.probability}% probability</p>
                {openDeal.source && (
                  <p className="text-muted">{t("crmPro.source")}: {openDeal.source}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("crmPro.noOpenDeal")}</p>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CrmSendEmail
              target="contact"
              recordId={clientId}
              defaultTo={client.email}
              onSent={() => void load()}
            />
          </Card>

          <Card>
            <CardHeader title={t("crmPro.addNote")} />
            <div className="space-y-3">
              <input
                className={inputClass}
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder={t("crmPro.noteTitlePlaceholder")}
              />
              <textarea
                className={`${inputClass} min-h-[88px] resize-y`}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder={t("crmPro.noteBodyPlaceholder")}
              />
              <button
                type="button"
                disabled={savingNote || !noteTitle.trim()}
                onClick={() => void addNote()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
              >
                {savingNote ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t("crmPro.saveNote")}
              </button>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("crmPro.tasksTitle")} description={t("crmPro.tasksDesc")} />
            <div className="space-y-3">
              <input
                className={inputClass}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={t("crmPro.taskTitlePlaceholder")}
              />
              <input
                type="datetime-local"
                className={inputClass}
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
              />
              <button
                type="button"
                disabled={savingTask || !taskTitle.trim()}
                onClick={() => void addTask()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
              >
                {savingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("crmPro.addTask")}
              </button>
              <ul className="space-y-2 pt-2">
                {tasks.filter((task) => task.status !== "done").map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-card-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{task.title}</p>
                      {task.due_at && (
                        <p className="text-xs text-muted">
                          {t("crmPro.taskDue")}: {new Date(task.due_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void completeTask(task.id)}
                      className="shrink-0 text-xs text-accent hover:underline"
                    >
                      {t("crmPro.taskDone")}
                    </button>
                  </li>
                ))}
                {tasks.filter((task) => task.status !== "done").length === 0 && (
                  <p className="text-sm text-muted">{t("crmPro.noTasks")}</p>
                )}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t("crmPro.timelineTitle")}
              description={t("crmPro.timelineDesc")}
            />
            <ActivityTimeline items={timeline} locale={locale} />
          </Card>
        </div>
      </div>
    </div>
  );
}
