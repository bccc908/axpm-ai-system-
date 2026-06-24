"use client";

import { formatCurrency } from "@/lib/utils";

type FunnelStage = {
  stage_id: string;
  name: string;
  color: string;
  count: number;
  value: number;
};

export type CrmReports = {
  conversionRate: number;
  winRate: number;
  wonCount: number;
  lostCount: number;
  openCount: number;
  wonValue: number;
  pipelineValue: number;
  weightedForecast: number;
  funnel: FunnelStage[];
};

export function CrmReportsPanel({
  reports,
  t,
}: {
  reports: CrmReports;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const maxCount = Math.max(...reports.funnel.map((f) => f.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("crmPro.reportConversion")} value={`${reports.conversionRate}%`} />
        <Metric label={t("crmPro.reportWinRate")} value={`${reports.winRate}%`} />
        <Metric
          label={t("crmPro.reportForecast")}
          value={formatCurrency(reports.weightedForecast, "MYR")}
        />
        <Metric
          label={t("crmPro.reportWonValue")}
          value={formatCurrency(reports.wonValue, "MYR")}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">{t("crmPro.reportFunnel")}</h3>
        <div className="space-y-3">
          {reports.funnel.map((stage) => (
            <div key={stage.stage_id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{stage.name}</span>
                <span className="text-muted">
                  {stage.count} · {formatCurrency(stage.value, "MYR")}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-card-border/60">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(8, (stage.count / maxCount) * 100)}%`,
                    backgroundColor: `#${stage.color}`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted">
        <span>{t("crmPro.reportOpen", { n: reports.openCount })}</span>
        <span>{t("crmPro.reportWon", { n: reports.wonCount })}</span>
        <span>{t("crmPro.reportLost", { n: reports.lostCount })}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-background/50 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
