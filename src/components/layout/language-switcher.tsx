"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useLocale();

  const options: { value: Locale; label: string }[] = [
    { value: "en", label: t("lang.en") },
    { value: "zh", label: t("lang.zh") },
  ];

  if (compact) {
    return (
      <div className={cn("flex flex-col items-center gap-1", className)}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLocale(opt.value)}
            className={cn(
              "rounded px-1 py-0.5 text-[10px] font-semibold",
              locale === opt.value ? "text-accent" : "text-muted",
            )}
            aria-label={opt.label}
            aria-pressed={locale === opt.value}
          >
            {opt.value === "zh" ? "中" : "EN"}
          </button>
        ))}
      </div>
    );
  }

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
