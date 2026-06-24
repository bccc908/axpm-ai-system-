"use client";

import { ChevronRight } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { BIAS_STYLE, formatSignalTime } from "@/components/gold/gold-desk-types";
import { cn } from "@/lib/utils";
import type { GoldSignal } from "@/types/gold-signal";

export function GoldSignalHistory({
  signals,
  onSelect,
}: {
  signals: GoldSignal[];
  onSelect: (signal: GoldSignal) => void;
}) {
  const { t, locale } = useLocale();

  if (signals.length <= 1) return null;

  return (
    <div className="gold-desk-panel overflow-hidden">
      <div className="gold-desk-panel-header">
        <span>{t("goldSignals.history")}</span>
        <span className="font-mono normal-case tracking-normal">{signals.length - 1}</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {signals.slice(1, 7).map((s) => {
          const style = BIAS_STYLE[s.bias];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span className={cn("w-14 shrink-0 font-mono text-[10px] font-bold uppercase", style.accent)}>
                {t(`goldSignals.bias.${s.bias}`)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">
                {s.thesis.split("\n")[0]}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted">
                {formatSignalTime(s.created_at, locale)}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted/50" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
