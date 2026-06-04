"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { Client } from "@/types/database";

type LeadAnalysis = {
  id: string;
  name: string;
  score: number;
  status: string;
  tags: string[];
  analysis?: string;
};

export function AutomationDashboard() {
  const { t } = useLocale();
  const [clients, setClients] = useState<Client[]>([]);
  const [analyses, setAnalyses] = useState<LeadAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [lastReport, setLastReport] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const [llmLabel, setLlmLabel] = useState("AI");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      const list: Client[] = data.clients ?? [];
      setClients(list);
      setAnalyses(
        list.map((c) => ({
          id: c.id,
          name: c.name,
          score: c.deposit_amount > 10000 ? 85 : c.deposit_amount > 0 ? 65 : 40,
          status: c.lead_status,
          tags: c.tags,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d) => {
        setLlmReady(Boolean(d.configured));
        setLlmLabel(d.providerLabel ?? "AI");
      })
      .catch(() => setLlmReady(false));
  }, [load]);

  async function runAiAnalysis() {
    setAnalyzing(true);
    try {
      const results: LeadAnalysis[] = [];
      for (const client of clients.slice(0, 5)) {
        const res = await fetch("/api/ai/analyze-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name,
            leadStatus: client.lead_status,
            depositAmount: client.deposit_amount,
            notes: client.notes,
            tags: client.tags,
          }),
        });
        const data = await res.json();
        results.push({
          id: client.id,
          name: client.name,
          score: data.score ?? 0,
          status: client.lead_status,
          tags: data.suggestedTags ?? client.tags,
          analysis: data.analysis,
        });
      }
      setAnalyses(results);
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyTags(row: LeadAnalysis) {
    setApplyingId(row.id);
    try {
      await fetch(`/api/clients/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: row.tags }),
      });
      alert(t("automation.tagsApplied"));
      load();
    } finally {
      setApplyingId(null);
    }
  }

  async function generateReport() {
    setReportLoading(true);
    try {
      const res = await fetch("/api/crm/daily-report", { method: "POST" });
      const data = await res.json();
      setLastReport(data.report?.content ?? null);
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("automation.title")}</h1>
          <p className="mt-1 text-muted">{t("automation.subtitle")}</p>
        </div>
        {llmReady !== null && (
          <Badge variant={llmReady ? "default" : "muted"}>
            {llmLabel}: {llmReady ? t("settings.connected") : t("settings.notConfigured")}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title={t("automation.leadAnalysis")} description={t("automation.leadAnalysisDesc")} />
          <button type="button" onClick={runAiAnalysis} disabled={analyzing || clients.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("ai.generate")}
          </button>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.dailyReportTitle")} description={t("dashboard.generateNew")} />
          <button type="button" onClick={generateReport} disabled={reportLoading} className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("dashboard.generateNew")}
          </button>
        </Card>
      </div>

      {lastReport && (
        <Card>
          <CardHeader title={t("dashboard.dailyReportTitle")} />
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{lastReport}</p>
        </Card>
      )}

      <Card>
        <CardHeader title={t("automation.leadAnalysis")} description={t("automation.leadAnalysisDesc")} />
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-muted">
                  <th className="pb-3 pr-4 font-medium">{t("dashboard.client")}</th>
                  <th className="pb-3 pr-4 font-medium">{t("automation.score")}</th>
                  <th className="pb-3 pr-4 font-medium">{t("dashboard.status")}</th>
                  <th className="pb-3 pr-4 font-medium">{t("clients.tags")}</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((row) => (
                  <tr key={row.id} className="border-b border-card-border/50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-foreground">{row.name}</p>
                      {row.analysis && <p className="mt-1 text-xs text-muted">{row.analysis}</p>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-card-border">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${row.score}%` }} />
                        </div>
                        <span>{row.score}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 capitalize text-muted">{row.status}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {row.tags.map((tag) => <Badge key={tag} variant="muted">{tag}</Badge>)}
                      </div>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={applyingId === row.id || row.tags.length === 0}
                        onClick={() => applyTags(row)}
                        className="rounded-lg border border-card-border px-3 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
                      >
                        {applyingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t("automation.applyTags")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
