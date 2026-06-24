"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Bell, Globe, Loader2, Mail, MessageCircle, MessagesSquare, Target, TrendingUp, Users } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { AccountsPanel } from "@/components/crm/accounts-panel";
import { ClientsManager } from "@/components/crm/clients-manager";
import { CrmAdvancedReports } from "@/components/crm/crm-advanced-reports";
import { CrmAssignmentPanel } from "@/components/crm/crm-assignment-panel";
import { CrmImportExport } from "@/components/crm/crm-import-export";
import type { CrmReports } from "@/components/crm/crm-reports";
import { CrmWorkflowsPanel } from "@/components/crm/crm-workflows-panel";
import { LeadsPanel } from "@/components/crm/leads-panel";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { CrmAdvancedAnalytics } from "@/lib/crm/analytics";

type Tab = "leads" | "contacts" | "accounts" | "deals" | "reports";

type CrmStats = {
  totalContacts: number;
  openDeals: number;
  pipelineValue: number;
  webLeads: number;
  openLeads: number;
  totalLeads: number;
  totalAccounts: number;
  activitiesToday: number;
  reports?: CrmReports;
  analytics?: CrmAdvancedAnalytics;
};

const TAB_IDS: Tab[] = ["leads", "contacts", "accounts", "deals", "reports"];

function parseTab(value: string | null): Tab {
  if (value && TAB_IDS.includes(value as Tab)) return value as Tab;
  return "leads";
}

export function ZohoCrmHub() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get("tab")));
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const selectTab = (next: Tab) => {
    setTab(next);
    router.replace(`/dashboard/crm?tab=${next}`, { scroll: false });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/stats");
      const data = await res.json();
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "leads", label: t("zoho.tabLeads") },
    { id: "contacts", label: t("zoho.tabContacts") },
    { id: "accounts", label: t("zoho.tabAccounts") },
    { id: "deals", label: t("zoho.tabDeals") },
    { id: "reports", label: t("zoho.tabReports") },
  ];

  const statCards = stats
    ? [
        { label: t("zoho.statOpenLeads"), value: String(stats.openLeads), icon: Target },
        { label: t("crmPro.statContacts"), value: String(stats.totalContacts), icon: Users },
        { label: t("zoho.statAccounts"), value: String(stats.totalAccounts), icon: Building2 },
        { label: t("crmPro.statOpenDeals"), value: String(stats.openDeals), icon: TrendingUp },
        {
          label: t("crmPro.statPipeline"),
          value: formatCurrency(stats.pipelineValue, "MYR"),
          icon: Globe,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("nav.customerHub")}</h1>
          <p className="mt-1 text-muted">{t("zoho.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/dashboard/conversations" icon={MessagesSquare} label={t("crmPro.inbox")} />
          <QuickLink href="/dashboard/whatsapp" icon={MessageCircle} label={t("nav.whatsapp")} />
          <QuickLink href="/dashboard/email" icon={Mail} label={t("nav.email")} />
          <QuickLink href="/dashboard/reminders" icon={Bell} label={t("nav.reminders")} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
                </div>
                <div className="rounded-xl bg-accent/10 p-2">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CrmImportExport onImported={() => setRefreshKey((k) => k + 1)} />

      <div className="flex flex-wrap gap-1 border-b border-card-border pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              tab === item.id
                ? "bg-card text-accent border border-card-border border-b-transparent -mb-px"
                : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card className="p-4 sm:p-6">
        {tab === "leads" && (
          <div className="space-y-6">
            <CrmAssignmentPanel />
            <LeadsPanel key={refreshKey} />
          </div>
        )}
        {tab === "contacts" && <ClientsManager embedded key={refreshKey} />}
        {tab === "accounts" && <AccountsPanel key={refreshKey} />}
        {tab === "deals" && (
          <div className="space-y-6">
            <CrmWorkflowsPanel />
            <PipelineBoard />
          </div>
        )}
        {tab === "reports" && stats?.reports && stats.analytics && (
          <CrmAdvancedReports reports={stats.reports} analytics={stats.analytics} t={t} />
        )}
      </Card>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: Route;
  icon: typeof MessagesSquare;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-accent"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
