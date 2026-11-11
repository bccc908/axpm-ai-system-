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
import type { DeskSignal } from "@/lib/market-signals/instruments";
import { useGoldDesk } from "@/components/gold/gold-desk-context";

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
  i18nNs = "goldSignals",
}: {
  view: DeskView;
  heatmapMode: HeatmapMode;
  signal: DeskSignal | null;
  loading: boolean;
  i18nNs?: string;
}) {
  const { t } = useLocale();
  const { livePrice, structureBars } = useGoldDesk();
  const showHeatmap = view === "heatmap";
  const hasLiveDesk = livePrice != null || structureBars.length >= 4;
  const showHeatmapEmpty = !signal && !loading && showHeatmap && !hasLiveDesk;

  return (
    <div className="gold-desk-panel flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-[#262d3d] bg-[#171c2a]">
      <div className="gold-desk-panel-header">
        <span className="flex items-center gap-2">
          <Radio className="h-3 w-3 text-muted" />
          {t(viewLabelKey(view, heatmapMode))}
        </span>
        {signal ? (
          <span className="rounded border border-card-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal tabular-nums text-foreground">
            {t(`goldSignals.strength.${signal.strength}`)} · {signal.confidence}%
          </span>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1 bg-[#171c2a]">
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
        {showHeatmapEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-muted backdrop-blur-sm">
            {t(`${i18nNs}.empty`)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
