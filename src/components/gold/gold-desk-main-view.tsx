"use client";

import dynamic from "next/dynamic";
import { Loader2, Radio } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { GoldHeatmapViz } from "@/components/gold/gold-heatmap-viz";
import { GoldOrderFlowViz } from "@/components/gold/gold-order-flow";
import {
  HEATMAP_MODES,
  type DeskView,
  type HeatmapMode,
} from "@/components/gold/gold-desk-types";
import type { GoldSignal } from "@/types/gold-signal";

const GoldTradingChart = dynamic(
  () => import("@/components/gold/gold-trading-chart").then((m) => m.GoldTradingChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        Chart…
      </div>
    ),
  },
);

function viewLabelKey(view: DeskView, heatmapMode: HeatmapMode) {
  if (view === "chart") return "goldSignals.modeChart";
  if (view === "orderflow") return "goldSignals.modeOrderFlow";
  return HEATMAP_MODES.find((m) => m.id === heatmapMode)?.labelKey ?? "goldSignals.modeHeatmap";
}

export function GoldDeskMainView({
  view,
  heatmapMode,
  signal,
  loading,
}: {
  view: DeskView;
  heatmapMode: HeatmapMode;
  signal: GoldSignal | null;
  loading: boolean;
}) {
  const { t } = useLocale();
  const showHeatmap = view === "heatmap";

  return (
    <div className="gold-desk-panel flex min-h-[480px] flex-col overflow-hidden border-[#1e2836] bg-[#0a0e14] xl:min-h-[620px]">
      <div className="gold-desk-panel-header">
        <span className="flex items-center gap-2">
          <Radio className="h-3 w-3 text-accent" />
          {t(viewLabelKey(view, heatmapMode))}
        </span>
        {signal ? (
          <span className="rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent shadow-[0_0_12px_-4px_rgba(212,168,83,0.4)]">
            {t(`goldSignals.strength.${signal.strength}`)} · {signal.confidence}%
          </span>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1 bg-[#0a0e14]">
        {view === "chart" ? (
          <GoldTradingChart signal={signal} className="h-full" />
        ) : view === "orderflow" ? (
          <GoldOrderFlowViz signal={signal} className="h-full" />
        ) : loading && !signal ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            {t("goldSignals.loading")}
          </div>
        ) : (
          <GoldHeatmapViz signal={signal} mode={heatmapMode} className="h-full w-full" />
        )}
        {!signal && !loading && showHeatmap ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-muted backdrop-blur-sm">
            {t("goldSignals.empty")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
