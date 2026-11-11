import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CandlestickChart,
  Layers,
  Minus,
  ScrollText,
  Waves,
  Zap,
} from "lucide-react";
import type { DeskSignal } from "@/lib/market-signals/instruments";

/** Primary desk views */
export type DeskView = "chart" | "orderflow" | "heatmap";

/** Heatmap sub-views (simulated liquidity layers) */
export type HeatmapMode = "heatmap" | "footprint" | "absorption" | "imbalance" | "delta";

export type GoldSignalBias = DeskSignal["bias"];

export const BIAS_STYLE: Record<
  GoldSignalBias,
  { icon: typeof ArrowUpRight; pill: string; accent: string; rail: string }
> = {
  long: {
    icon: ArrowUpRight,
    pill: "text-success bg-success/10 border-success/30",
    accent: "text-success",
    rail: "border-success/40 text-success",
  },
  short: {
    icon: ArrowDownRight,
    pill: "text-danger bg-danger/10 border-danger/30",
    accent: "text-danger",
    rail: "border-danger/40 text-danger",
  },
  neutral: {
    icon: Minus,
    pill: "text-foreground bg-surface-2 border-card-border",
    accent: "text-muted",
    rail: "border-border-strong text-muted",
  },
  wait: {
    icon: Activity,
    pill: "text-accent bg-accent/10 border-accent/30",
    accent: "text-accent",
    rail: "border-accent/35 text-accent",
  },
};

export const DESK_VIEWS: { id: DeskView; icon: typeof Layers; labelKey: string }[] = [
  { id: "chart", icon: CandlestickChart, labelKey: "goldSignals.modeChart" },
  { id: "orderflow", icon: ScrollText, labelKey: "goldSignals.modeOrderFlow" },
  { id: "heatmap", icon: Layers, labelKey: "goldSignals.modeHeatmap" },
];

export const HEATMAP_MODES: { id: HeatmapMode; icon: typeof Layers; labelKey: string }[] = [
  { id: "heatmap", icon: Layers, labelKey: "goldSignals.modeHeatmap" },
  { id: "footprint", icon: BarChart3, labelKey: "goldSignals.modeFootprint" },
  { id: "absorption", icon: Waves, labelKey: "goldSignals.modeAbsorption" },
  { id: "imbalance", icon: Zap, labelKey: "goldSignals.modeImbalance" },
  { id: "delta", icon: Activity, labelKey: "goldSignals.modeDelta" },
];

export type LadderRow = {
  price: number;
  tag?: string;
  bidSize: number;
  askSize: number;
  bidPct: number;
  askPct: number;
  isSpot: boolean;
};

export function formatPrice(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export function formatZone(zone: DeskSignal["entry_zone"]) {
  if (!zone) return "—";
  return `${zone.low.toFixed(2)} – ${zone.high.toFixed(2)}`;
}

export function formatSignalTime(iso: string, locale: string) {
  if (locale === "zh") {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Simulated DOM ladder around spot (no L2 feed). */
export function buildPriceLadder(signal: DeskSignal | null, spotOverride?: number | null): LadderRow[] {
  const spot = spotOverride ?? signal?.spot_price;
  if (spot == null) return [];

  const tags = new Map<number, string>();
  if (signal?.stop_loss) tags.set(Math.round(signal.stop_loss * 100) / 100, "STOP");
  if (signal?.entry_zone) {
    tags.set(signal.entry_zone.low, "ENTRY");
    tags.set(signal.entry_zone.high, "ENTRY");
  }
  signal?.take_profit.forEach((p, i) => tags.set(p, `TP${i + 1}`));

  const rows: LadderRow[] = [];
  let maxSize = 1;
  for (let i = 0; i < 16; i++) {
    const price = Math.round((spot + (8 - i) * 2.5) * 100) / 100;
    const bidSize = Math.floor(18 + ((price * 13.7) % 95));
    const askSize = Math.floor(16 + ((price * 19.3) % 88));
    maxSize = Math.max(maxSize, bidSize, askSize);
    rows.push({
      price,
      tag: tags.get(price),
      bidSize,
      askSize,
      bidPct: 0,
      askPct: 0,
      isSpot: Math.abs(price - spot) < 1.5,
    });
  }
  return rows.map((r) => ({
    ...r,
    bidPct: (r.bidSize / maxSize) * 100,
    askPct: (r.askSize / maxSize) * 100,
  }));
}
