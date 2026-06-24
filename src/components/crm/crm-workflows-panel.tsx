"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import type { CrmWorkflow } from "@/types/crm-workflows";

export function CrmWorkflowsPanel() {
  const { t } = useLocale();
  const [workflows, setWorkflows] = useState<CrmWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/workflows");
      const data = await res.json();
      setWorkflows(data.workflows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string, enabled: boolean) {
    const next = workflows.map((w) => (w.id === id ? { ...w, enabled } : w));
    setWorkflows(next);
    setSaving(true);
    try {
      await fetch("/api/crm/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflows: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader
        title={t("zoho.workflowsTitle")}
        description={t("zoho.workflowsDesc")}
      />
      <ul className="mt-4 space-y-3">
        {workflows.map((rule) => (
          <li
            key={rule.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-card-border px-3 py-2.5 text-sm"
          >
            <div>
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Zap className="h-3.5 w-3.5 text-warning" />
                {rule.name}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("zoho.workflowWhen")}{" "}
                {rule.trigger === "deal_stage"
                  ? t("zoho.workflowDealStage", { stage: rule.trigger_value })
                  : t("zoho.workflowLeadStatus", { status: rule.trigger_value })}
                {" → "}
                {rule.action === "notify_telegram"
                  ? t("zoho.workflowTelegram", {
                      message: rule.telegram_message || rule.name,
                    })
                  : t("zoho.workflowTask", { title: rule.task_title })}
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={rule.enabled}
                disabled={saving}
                onChange={(e) => void toggle(rule.id, e.target.checked)}
                className="rounded border-card-border"
              />
              {rule.enabled ? t("zoho.workflowOn") : t("zoho.workflowOff")}
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
