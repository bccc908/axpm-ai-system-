"use client";

import {
  Bell,
  DollarSign,
  Kanban,
  Loader2,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IntegrationsStatus } from "@/components/dashboard/integrations-status";
import { PersonalLiveStats } from "@/components/dashboard/personal-live-stats";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatDateLocalized } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import type { Client, FollowUp } from "@/types/database";
import type { CrmOverview } from "@/types/crm";

type ConversationThread = {
  client_id: string | null;
  client_name: string;
  message_count: number;
  last_message_at: string;
  last_preview: string;
};

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

export function DashboardHome() {
  const { t, locale } = useLocale();
  const [overview, setOverview] = useState<CrmOverview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [ovRes, clientRes, convRes] = await Promise.all([
        fetch("/api/crm/overview"),
        fetch("/api/clients"),
        fetch("/api/conversations"),
      ]);
      if (!ovRes.ok) {
        setLoadError(true);
        return;
      }
      const [ovData, clientData, convData] = await Promise.all([
        ovRes.json(),
        clientRes.json(),
        convRes.json(),
      ]);
      setOverview(ovData.overview ?? null);
      setClients(clientData.clients ?? []);
      setThreads((convData.threads ?? []).slice(0, 5));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (loadError || !overview) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-6 text-center">
        <p className="font-medium text-foreground">{t("help.pageError")}</p>
        <p className="mt-2 text-sm text-muted">{t("help.pageErrorFix")}</p>
        <button
          type="button"
          onClick={() => load()}
          className="mt-4 rounded-md btn-premium px-4 py-2 text-sm"
        >
          {t("common.refresh")}
        </button>
      </div>
    );
  }

  const followUps: FollowUp[] = overview.recentFollowUps;

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />

      <IntegrationsStatus />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dashboard.totalClients")} value={overview.totalClients} subtext={t("dashboard.thisWeek")} icon={Users} trend="up" />
        <StatCard label={t("dashboard.followUpsDue")} value={overview.followUpsDueToday} subtext={t("dashboard.actionRequired")} icon={Bell} trend={overview.followUpsDueToday > 0 ? "down" : "neutral"} />
        <StatCard label={t("dashboard.totalDeposits")} value={formatCurrency(overview.totalDeposits)} subtext={t("dashboard.acrossClients")} icon={DollarSign} trend="up" />
        <StatCard label={t("dashboard.pendingTasks")} value={overview.pendingTasks} subtext={t("dashboard.teamReminders")} icon={MessageSquare} />
      </div>

      <PersonalLiveStats />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("dashboard.myAssistantTitle")} description={t("dashboard.myAssistantDesc")} action={<Link href="/dashboard/my-assistant" className="text-sm text-accent hover:underline">{t("common.open")}</Link>} />
          <p className="text-sm text-muted">{t("dashboard.myAssistantBody")}</p>
          <Link href="/dashboard/my-assistant" className="mt-4 inline-flex items-center gap-2 rounded-md btn-premium px-3.5 py-2 text-sm">
            <NotebookPen className="h-4 w-4" />{t("dashboard.goAssistant")}
          </Link>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.financeTitle")} description={t("dashboard.financeDesc")} action={<Link href="/dashboard/finance" className="text-sm text-accent hover:underline">{t("common.open")}</Link>} />
          <p className="text-sm text-muted">{t("dashboard.financeBody")}</p>
          <Link href="/dashboard/finance" className="mt-4 inline-flex items-center gap-2 rounded-md border border-card-border bg-surface-2 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong">
            <Wallet className="h-4 w-4" />{t("dashboard.goFinance")}
          </Link>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.inboxTitle")} description={t("dashboard.inboxDesc")} action={<Link href="/dashboard/conversations" className="text-sm text-accent hover:underline">{t("common.open")}</Link>} />
          <p className="text-sm text-muted">{t("dashboard.inboxBody")}</p>
          <Link href="/dashboard/conversations" className="mt-4 inline-flex items-center gap-2 rounded-md border border-card-border bg-surface-2 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong">
            <MessagesSquare className="h-4 w-4" />{t("dashboard.goInbox")}
          </Link>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.crmTitle")} description={t("dashboard.crmDesc")} action={<Link href="/dashboard/crm" className="text-sm text-accent hover:underline">{t("common.open")}</Link>} />
          <p className="text-sm text-muted">{t("dashboard.crmBody")}</p>
          <Link href="/dashboard/crm" className="mt-4 inline-flex items-center gap-2 rounded-md border border-card-border bg-surface-2 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong">
            <Kanban className="h-4 w-4" />{t("dashboard.goCrm")}
          </Link>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.clientsDueTitle")} description={t("dashboard.clientsDueDesc")} action={<Link href="/dashboard/crm?tab=contacts" className="text-sm text-accent hover:underline">{t("dashboard.viewAll")}</Link>} />
          <div className="space-y-3">
            {overview.clientsDueToday.length === 0 ? (
              <p className="text-sm text-muted">{t("dashboard.noFollowUps")}</p>
            ) : (
              overview.clientsDueToday.map((client) => (
                <div key={client.id} className="flex items-center justify-between rounded-md border border-card-border bg-background px-3.5 py-2.5">
                  <div>
                    <p className="font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted">
                      {client.next_follow_up_at ? formatDateLocalized(client.next_follow_up_at, locale) : "—"}
                      {client.ib_source ? ` · ${client.ib_source}` : ""}
                    </p>
                  </div>
                  <Badge variant={leadStatusVariant[client.lead_status] ?? "muted"}>{client.lead_status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.dailyReportTitle")} description={overview.latestDailyReport ? formatDateLocalized(overview.latestDailyReport.report_date, locale) : "—"} action={<Link href="/dashboard/automation" className="text-sm text-accent hover:underline">{t("dashboard.generateNew")}</Link>} />
          <p className="text-sm leading-relaxed text-foreground/90">
            {overview.latestDailyReport?.content ?? t("dashboard.noReportYet")}
          </p>
          {overview.latestDailyReport && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Object.entries(overview.latestDailyReport.metrics).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-card-border bg-background/50 px-3 py-2">
                  <p className="text-xs capitalize text-muted">{key.replace(/_/g, " ")}</p>
                  <p className="text-lg font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t("dashboard.recentChats")}
          description={t("dashboard.recentChatsDesc")}
          action={
            <Link href="/dashboard/conversations" className="text-sm text-accent hover:underline">
              {t("dashboard.viewConversations")}
            </Link>
          }
        />
        {threads.length === 0 ? (
          <p className="text-sm text-muted">{t("dashboard.noConversations")}</p>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <div
                key={thread.client_id ?? thread.client_name}
                className="flex items-center justify-between rounded-md border border-card-border bg-background px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{thread.client_name}</p>
                  <p className="truncate text-xs text-muted">{thread.last_preview}</p>
                </div>
                <div className="ml-4 text-right">
                  <Badge variant="muted">{thread.message_count}</Badge>
                  <p className="mt-1 text-xs text-muted">
                    {formatDateLocalized(thread.last_message_at, locale)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={t("dashboard.recentActivity")} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-[11px] uppercase tracking-[0.06em] text-muted">
                <th className="pb-2 pr-4 font-semibold">{t("dashboard.client")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("dashboard.channel")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("dashboard.summary")}</th>
                <th className="pb-2 font-semibold">{t("dashboard.status")}</th>
              </tr>
            </thead>
            <tbody>
              {followUps.map((fu) => {
                const client = clients.find((c) => c.id === fu.client_id);
                return (
                  <tr key={fu.id} className="border-b border-card-border/60 hover:bg-surface-2">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{client?.name ?? "—"}</td>
                    <td className="py-2.5 pr-4 capitalize text-muted">{fu.channel}</td>
                    <td className="py-2.5 pr-4 text-foreground/80">{fu.summary ?? fu.notes}</td>
                    <td className="py-2.5">
                      <Badge variant={fu.completed_at ? "success" : "warning"}>
                        {fu.completed_at ? t("common.done") : t("dashboard.scheduled")}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
