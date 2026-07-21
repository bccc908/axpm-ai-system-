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
    pill: "text-emerald-200 bg-emerald-500/15 border-emerald-400/35",
    accent: "text-emerald-400",
    rail: "border-emerald-500/40 text-emerald-400",
  },
  short: {
    icon: ArrowDownRight,
    pill: "text-rose-200 bg-rose-500/15 border-rose-400/35",
    accent: "text-rose-400",
    rail: "border-rose-500/40 text-rose-400",
  },
  neutral: {
    icon: Minus,
    pill: "text-amber-100 bg-amber-500/12 border-amber-400/30",
    accent: "text-amber-300",
    rail: "border-amber-500/35 text-amber-300",
  },
  wait: {
    icon: Activity,
    pill: "text-sky-100 bg-sky-500/12 border-sky-400/30",
    accent: "text-sky-300",
    rail: "border-sky-500/35 text-sky-300",
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
