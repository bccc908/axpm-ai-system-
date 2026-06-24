"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { CardHeader } from "@/components/ui/card";

export function CrmAssignmentPanel() {
  const { t } = useLocale();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setEnabled(data.settings?.crmWidgetAutoAssign !== false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-card-border p-4">
      <CardHeader
        title={t("zoho.assignmentTitle")}
        description={t("zoho.assignmentDesc")}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Users className="h-4 w-4 text-accent" />
          {enabled ? t("zoho.assignmentOn") : t("zoho.assignmentOff")}
        </div>
        <Link
          href="/dashboard/settings"
          className="text-accent hover:underline"
        >
          {t("zoho.assignmentSettings")}
        </Link>
      </div>
    </div>
  );
}
