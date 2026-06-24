"use client";

import { formatCurrency } from "@/lib/utils";
import type { CrmAdvancedAnalytics } from "@/lib/crm/analytics";
import { CrmReportsPanel, type CrmReports } from "@/components/crm/crm-reports";
import { CardHeader } from "@/components/ui/card";

export function CrmAdvancedReports({
  reports,
  analytics,
  t,
}: {
  reports: CrmReports;
  analytics: CrmAdvancedAnalytics;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const maxSource = Math.max(...analytics.leadSources.map((s) => s.count), 1);
  const maxMonthly = Math.max(
    ...analytics.monthlyTrend.map((m) => Math.max(m.won, m.lost)),
    1,
  );

  return (
    <div className="space-y-8">
      <CrmReportsPanel reports={reports} t={t} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <CardHeader title={t("zoho.reportLeadConversion")} />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <MiniMetric
              label={t("zoho.reportLeadRate")}
              value={`${analytics.leadConversionRate}%`}
            />
            <MiniMetric
              label={t("zoho.reportConvertedLeads")}
              value={String(analytics.convertedLeads)}
            />
            <MiniMetric label={t("zoho.reportOpenLeadsCount")} value={String(analytics.openLeads)} />
          </div>
        </section>

        <section>
          <CardHeader title={t("zoho.reportLeadSources")} />
          <div className="mt-3 space-y-2">
            {analytics.leadSources.length === 0 ? (
              <p className="text-sm text-muted">{t("zoho.reportNoSources")}</p>
            ) : (
              analytics.leadSources.map((row) => (
                <div key={row.source} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize text-foreground">{row.source}</span>
                    <span className="text-muted">{row.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-card-border/60">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(8, (row.count / maxSource) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section>
        <CardHeader title={t("zoho.reportMonthlyTrend")} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {analytics.monthlyTrend.map((month) => (
            <div
              key={month.month}
              className="rounded-xl border border-card-border bg-background/50 p-3 text-sm"
            >
              <p className="font-medium text-foreground">{month.label}</p>
              <div className="mt-2 space-y-1 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-success" />
                  {t("crmPro.reportWon", { n: month.won })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-danger" />
                  {t("crmPro.reportLost", { n: month.lost })}
                </div>
                <p>{formatCurrency(month.wonValue, "MYR")}</p>
              </div>
              <div className="mt-2 flex h-8 items-end gap-1">
                <div
                  className="flex-1 rounded-t bg-success/70"
                  style={{ height: `${Math.max(4, (month.won / maxMonthly) * 100)}%` }}
                />
                <div
                  className="flex-1 rounded-t bg-danger/60"
                  style={{ height: `${Math.max(4, (month.lost / maxMonthly) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <CardHeader title={t("zoho.reportTeamPerformance")} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-card-border text-muted">
                <th className="pb-2 pr-4 font-medium">{t("zoho.reportTeamMember")}</th>
                <th className="pb-2 pr-4 font-medium">{t("zoho.reportOpenDeals")}</th>
                <th className="pb-2 pr-4 font-medium">{t("zoho.reportWonDeals")}</th>
                <th className="pb-2 font-medium">{t("zoho.reportWonValue")}</th>
              </tr>
            </thead>
            <tbody>
              {analytics.teamPerformance.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-muted">
                    {t("zoho.reportNoTeam")}
                  </td>
                </tr>
              ) : (
                analytics.teamPerformance.map((row) => (
                  <tr key={row.member_id} className="border-b border-card-border/60">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{row.name}</td>
                    <td className="py-2.5 pr-4 text-muted">{row.open_deals}</td>
                    <td className="py-2.5 pr-4 text-muted">{row.won_deals}</td>
                    <td className="py-2.5 text-muted">
                      {formatCurrency(row.won_value, "MYR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-background/50 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
