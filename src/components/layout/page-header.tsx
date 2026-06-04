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
        <h1 className="text-2xl font-bold text-foreground">{t(titleKey)}</h1>
        <p className="mt-1 text-muted">{t(subtitleKey)}</p>
      </div>
      {action}
    </div>
  );
}
