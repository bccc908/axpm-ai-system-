"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { ratingLabel, type FortuneFeedbackStats } from "@/lib/fortune/feedback-stats";
import type { FortuneReadingFeedback } from "@/types/fortune";

type FeedbackResponse = {
  entries: FortuneReadingFeedback[];
  stats: FortuneFeedbackStats;
};

export function FortuneFeedbackHistory({
  locale,
  t,
}: {
  locale: "en" | "zh";
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [data, setData] = useState<FeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fortune/feedback");
      const json = await res.json();
      if (res.ok) {
        setData({ entries: json.entries ?? [], stats: json.stats });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("fortune.feedbackHistoryLoading")}
      </div>
    );
  }

  const stats = data?.stats;
  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      {stats && stats.total > 0 ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label={t("fortune.feedbackStatTotal")} value={String(stats.total)} />
          <StatCard label={t("fortune.feedbackStatAccurate")} value={String(stats.accurate)} />
          <StatCard label={t("fortune.feedbackStatPartial")} value={String(stats.partial)} />
          <StatCard
            label={t("fortune.feedbackStatRate")}
            value={stats.accuracyRate !== null ? `${stats.accuracyRate}%` : "—"}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-card-border bg-card/40 px-4 py-6 text-center text-sm text-muted">
          {t("fortune.feedbackHistoryEmpty")}
        </p>
      )}

      {entries.length > 0 ? (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-card-border bg-card/40 p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{entry.reading_title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {entry.fortune_date ?? entry.updated_at.slice(0, 10)} · {entry.topic}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                    entry.rating === "accurate"
                      ? "bg-success/15 text-success"
                      : entry.rating === "partial"
                        ? "bg-warning/15 text-warning"
                        : "bg-danger/15 text-danger"
                  }`}
                >
                  {ratingLabel(entry.rating, locale)}
                </span>
              </div>
              {entry.actual_outcome ? (
                <p className="mt-2 text-xs text-muted">
                  <span className="text-foreground">{t("fortune.feedbackActual")}：</span>
                  {entry.actual_outcome}
                </p>
              ) : null}
              {entry.errors ? (
                <p className="mt-1 text-xs text-muted">
                  <span className="text-foreground">{t("fortune.feedbackErrors")}：</span>
                  {entry.errors}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <ClipboardCheck className="h-3.5 w-3.5" />
        {t("fortune.feedbackAutoHint")}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card/40 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
