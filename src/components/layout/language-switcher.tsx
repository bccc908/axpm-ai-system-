"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  const options: { value: Locale; label: string }[] = [
    { value: "en", label: t("lang.en") },
    { value: "zh", label: t("lang.zh") },
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Languages className="h-4 w-4 text-muted" aria-hidden />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="rounded-lg border border-card-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
        aria-label={t("lang.switch")}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
