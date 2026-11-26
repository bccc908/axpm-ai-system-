"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { canViewWorkflowRules } from "@/lib/crm/workflow-access";

export function CrmWorkflowsPanel() {
  const { t } = useLocale();
  const { user } = useAuth();
  const allowed = Boolean(user && canViewWorkflowRules(user.role));
  const [summary, setSummary] = useState<{ enabled: number; waiting: number } | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void fetch("/api/crm/workflows").then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) {
        setSummary({
          enabled: Number(data.enabled_count ?? 0),
          waiting: Number(data.waiting_count ?? 0),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) return null;

  return (
    <Card>
      <CardHeader title={t("workflowRules.title")} description={t("workflowRules.summaryDesc")} />
      <p className="text-sm text-foreground">
        {t("workflowRules.summary", {
          enabled: summary?.enabled ?? 0,
          waiting: summary?.waiting ?? 0,
        })}
      </p>
      <Link
        href="/dashboard/crm/workflow-rules"
        className="mt-3 inline-flex text-sm font-medium text-accent hover:underline"
      >
        {t("workflowRules.openPage")}
      </Link>
    </Card>
  );
}
