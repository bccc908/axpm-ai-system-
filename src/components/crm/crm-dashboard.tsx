"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Loader2, TrendingUp, Users, Wallet } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { CrmReportsPanel, type CrmReports } from "@/components/crm/crm-reports";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type CrmStats = {
  totalContacts: number;
  openDeals: number;
  pipelineValue: number;
  wonDeals: number;
  wonValue: number;
  webLeads: number;
  activitiesToday: number;
  reports?: CrmReports;
};

export function CrmDashboard() {
  const { t } = useLocale();
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  const statCards = stats
    ? [
        { label: t("crmPro.statContacts"), value: String(stats.totalContacts), icon: Users },
        { label: t("crmPro.statOpenDeals"), value: String(stats.openDeals), icon: TrendingUp },
        {
          label: t("crmPro.statPipeline"),
          value: formatCurrency(stats.pipelineValue, "MYR"),
          icon: Wallet,
        },
        { label: t("crmPro.statWebLeads"), value: String(stats.webLeads), icon: Globe },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("crmPro.title")}</h1>
          <p className="mt-1 text-muted">{t("crmPro.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/crm?tab=contacts"
            className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent"
          >
            {t("crmPro.allContacts")}
          </Link>
          <Link
            href="/dashboard/conversations"
            className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent"
          >
            {t("crmPro.inbox")}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

          {stats?.reports && (
            <Card className="p-4 sm:p-6">
              <CardHeader title={t("crmPro.reportsTitle")} description={t("crmPro.reportsDesc")} />
              <CrmReportsPanel reports={stats.reports} t={t} />
            </Card>
          )}

          <Card className="p-4 sm:p-6">
            <PipelineBoard />
          </Card>

          {stats && (
            <Card>
              <CardHeader
                title={t("crmPro.todayActivity")}
                description={t("crmPro.todayActivityDesc", { n: stats.activitiesToday })}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
