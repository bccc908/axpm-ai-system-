"use client";

import { Loader2, RefreshCw, Zap } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import {
  DESK_VIEWS,
  HEATMAP_MODES,
  type DeskView,
  type HeatmapMode,
} from "@/components/gold/gold-desk-types";
import { cn } from "@/lib/utils";
import type { SignalI18nNs } from "@/lib/market-signals/instruments";

export function GoldDeskToolbar({
  view,
  heatmapMode,
  loading,
  generating,
  onViewChange,
  onHeatmapModeChange,
  onRefresh,
  onGenerate,
  i18nNs = "goldSignals",
}: {
  view: DeskView;
  heatmapMode: HeatmapMode;
  loading: boolean;
  generating: boolean;
  i18nNs?: SignalI18nNs;
  onViewChange: (v: DeskView) => void;
  onHeatmapModeChange: (m: HeatmapMode) => void;
  onRefresh: () => void;
  onGenerate: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="gold-mode-rail overflow-x-auto">
          {DESK_VIEWS.map((m) => {
            const Icon = m.icon;
            const active = view === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onViewChange(m.id)}
                className={cn("gold-mode-tab shrink-0", active && "gold-mode-tab-active")}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(m.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-md border border-card-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {t(`${i18nNs}.refresh`)}
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-md btn-premium px-3.5 py-1.5 text-xs disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {generating ? t(`${i18nNs}.generating`) : t(`${i18nNs}.generate`)}
          </button>
        </div>
      </div>

      {view === "heatmap" ? (
        <div className="flex flex-wrap gap-1 rounded-md border border-card-border bg-background p-0.5">
          {HEATMAP_MODES.map((m) => {
            const Icon = m.icon;
            const active = heatmapMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onHeatmapModeChange(m.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-surface-3 text-foreground"
                    : "text-muted hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" />
                {t(m.labelKey)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
