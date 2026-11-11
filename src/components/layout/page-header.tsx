"use client";

import { useLocale } from "@/components/providers/locale-provider";

export function PageHeader({
  titleKey,
  subtitleKey,
  action,
}: {
  titleKey: string;
  subtitleKey: string;
  action?: React.ReactNode;
}) {
  const { t } = useLocale();

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t(titleKey)}</h1>
        <p className="mt-1 text-sm text-muted">{t(subtitleKey)}</p>
      </div>
      {action}
    </div>
  );
}
