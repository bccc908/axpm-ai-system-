"use client";

import { Brain } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { formatOkBrainMap, type OkBrainMap } from "@/lib/market-signals/ok-brain-map";
import type { SignalI18nNs } from "@/lib/market-signals/instruments";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["①", "②", "③", "④", "⑤"] as const;

export function OkBrainMapCard({
  map,
  i18nNs = "goldSignals",
  className,
}: {
  map: OkBrainMap;
  i18nNs?: SignalI18nNs;
  className?: string;
}) {
  const { t, locale } = useLocale();

  const elements: Array<{ label: string; value: string }> = [
    { label: t(`${i18nNs}.okBrainMapWhat`), value: map.what },
    { label: t(`${i18nNs}.okBrainMapKey`), value: map.key },
    { label: t(`${i18nNs}.okBrainMapFocus`), value: map.focus },
    { label: t(`${i18nNs}.okBrainMapContext`), value: map.context },
    { label: t(`${i18nNs}.okBrainMapAdvantage`), value: map.advantage },
    { label: t(`${i18nNs}.okBrainMapPrinciple`), value: map.principle },
    { label: t(`${i18nNs}.okBrainMapMethod`), value: map.method },
    { label: t(`${i18nNs}.okBrainMapDuration`), value: map.duration },
    { label: t(`${i18nNs}.okBrainMapGoal`), value: map.goal },
  ];

  return (
    <div className={cn("gold-desk-panel border-violet-500/15 p-4", className)}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">
        <Brain className="h-3 w-3" />
        {t(`${i18nNs}.okBrainMapTitle`)}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-foreground/90">
        {formatOkBrainMap(map, locale === "zh" ? "zh" : "en")}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
        {elements.map((el) => (
          <div
            key={el.label}
            className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5"
          >
            <p className="text-[9px] uppercase tracking-wider text-muted/70">{el.label}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground">{el.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {map.steps.map((step, i) => (
          <span
            key={`${STEP_LABELS[i]}-${step}`}
            className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-200"
          >
            {STEP_LABELS[i]}
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}
