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

export function GoldDeskToolbar({
  view,
  heatmapMode,
  loading,
  generating,
  onViewChange,
  onHeatmapModeChange,
  onRefresh,
  onGenerate,
}: {
  view: DeskView;
  heatmapMode: HeatmapMode;
  loading: boolean;
  generating: boolean;
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-muted transition-colors hover:border-accent/25 hover:text-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {t("goldSignals.refresh")}
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-xl btn-premium px-4 py-2 text-xs shadow-[0_0_24px_-4px_rgba(212,168,83,0.55)] disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {generating ? t("goldSignals.generating") : t("goldSignals.generate")}
          </button>
        </div>
      </div>

      {view === "heatmap" ? (
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-1">
          {HEATMAP_MODES.map((m) => {
            const Icon = m.icon;
            const active = heatmapMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onHeatmapModeChange(m.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors",
                  active
                    ? "bg-sky-500/15 text-sky-300"
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
