"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { CurrencyTotals } from "@/types/finance";

type PersonalSnapshot = {
  pendingJobs: number;
  doneJobs: number;
  workLogs: number;
  planProgress: string | null;
};

export function PersonalLiveStats() {
  const { t } = useLocale();
  const [personal, setPersonal] = useState<PersonalSnapshot | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyTotals[]>([]);
  const [paymentsDue, setPaymentsDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, logsRes, plansRes, financeRes] = await Promise.all([
        fetch("/api/personal/jobs"),
        fetch("/api/personal/logs"),
        fetch("/api/personal/plans"),
        fetch("/api/finance/overview"),
      ]);
      const [jobsData, logsData, plansData, financeData] = await Promise.all([
        jobsRes.json(),
        logsRes.json(),
        plansRes.json(),
        financeRes.json(),
      ]);

      const jobs = jobsData.jobs ?? [];
      const plans = plansData.plans ?? [];
      const today = new Date().toISOString().split("T")[0];
      const todayPlan = plans.find(
        (p: { period: string; plan_date: string }) =>
          p.period === "daily" && p.plan_date === today,
      );

      setPersonal({
        pendingJobs: jobs.filter(
          (j: { status: string }) => j.status === "todo" || j.status === "in_progress",
        ).length,
        doneJobs: jobs.filter((j: { status: string }) => j.status === "done").length,
        workLogs: (logsData.logs ?? []).length,
        planProgress: todayPlan
          ? `${todayPlan.items.filter((i: { done: boolean }) => i.done).length}/${todayPlan.items.length}`
          : null,
      });

      const overview = financeData.overview;
      setCurrencies(overview?.currencies ?? []);
      setPaymentsDue(
        (overview?.upcomingPayments ?? []).filter(
          (p: { needsReminder: boolean }) => p.needsReminder,
        ).length,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendDigest() {
    setSending(true);
    try {
      await fetch("/api/digest/daily", { method: "POST" });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-8 text-muted">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("common.loading")}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t("dashboard.personalSnapshot")}
        description={t("dashboard.personalSnapshotDesc")}
        action={
          <button
            type="button"
            onClick={sendDigest}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-muted disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {t("dashboard.sendDigest")}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/my-assistant"
          className="rounded-lg border border-card-border bg-background/50 p-4 hover:border-accent/40 transition-colors"
        >
          <p className="text-xs text-muted">{t("assistant.pendingJobs")}</p>
          <p className="mt-1 text-2xl font-bold text-accent">{personal?.pendingJobs ?? 0}</p>
          <p className="mt-1 text-xs text-muted">
            {personal?.doneJobs ?? 0} {t("assistant.completed").toLowerCase()}
          </p>
        </Link>

        <Link
          href="/dashboard/my-assistant"
          className="rounded-lg border border-card-border bg-background/50 p-4 hover:border-accent/40 transition-colors"
        >
          <p className="text-xs text-muted">{t("assistant.todaysPlan")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {personal?.planProgress ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {personal?.workLogs ?? 0} {t("assistant.workLogs").toLowerCase()}
          </p>
        </Link>

        {currencies.map((c) => (
          <Link
            key={c.currency}
            href="/dashboard/finance"
            className="rounded-lg border border-card-border bg-background/50 p-4 hover:border-success/40 transition-colors"
          >
            <p className="text-xs text-muted">
              {c.currency} {t("finance.netLabel")}
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${c.net >= 0 ? "text-success" : "text-danger"}`}
            >
              {formatCurrency(c.net, c.currency)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatCurrency(c.income, c.currency)} / {formatCurrency(c.expenses, c.currency)}
            </p>
          </Link>
        ))}
      </div>

      {paymentsDue > 0 && (
        <p className="mt-4 text-sm text-warning">
          {t("dashboard.paymentsDueSoon", { count: paymentsDue })}
        </p>
      )}
    </Card>
  );
}
