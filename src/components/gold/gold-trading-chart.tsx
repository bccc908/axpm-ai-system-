"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { computeEma, computeMacd, computeRsi } from "@/lib/gold-signals/chart-math";
import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import { VIZ } from "@/lib/gold-signals/viz-colors";
import { cn } from "@/lib/utils";
import type { GoldSignal } from "@/types/gold-signal";

export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h";

type BarPoint = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

const INTERVALS: ChartInterval[] = ["1m", "5m", "15m", "1h", "4h"];

const CHART_BASE = {
  layout: {
    background: { type: ColorType.Solid, color: "#050810" },
    textColor: "#94a8bc",
    fontFamily: "ui-monospace, monospace",
  },
  grid: {
    vertLines: { color: "rgba(56, 120, 180, 0.08)" },
    horzLines: { color: "rgba(56, 120, 180, 0.08)" },
  },
  rightPriceScale: { borderColor: "rgba(56, 120, 180, 0.15)" },
  timeScale: { borderColor: "rgba(56, 120, 180, 0.15)", timeVisible: true },
  crosshair: { mode: 1 as const },
};

export function GoldTradingChart({
  signal,
  className,
}: {
  signal: GoldSignal | null;
  className?: string;
}) {
  const { t } = useLocale();
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  const mainChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema9Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>[]>([]);
  const syncingRef = useRef(false);
  const lastBarsRef = useRef<GoldOhlcBar[]>([]);

  const [chartInterval, setChartInterval] = useState<ChartInterval>("5m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [rsiLive, setRsiLive] = useState<number | null>(null);
  const [macdLive, setMacdLive] = useState<number | null>(null);
  const [showEma, setShowEma] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [showMacd, setShowMacd] = useState(true);
  const [barCount, setBarCount] = useState(0);

  const syncCharts = useCallback((source: IChartApi, targets: IChartApi[]) => {
    source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (syncingRef.current || !range) return;
      syncingRef.current = true;
      for (const c of targets) {
        c.timeScale().setVisibleLogicalRange(range);
      }
      syncingRef.current = false;
    });
  }, []);

  const applySignalLevels = useCallback(() => {
    const series = candleRef.current;
    if (!series) return;
    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];
    if (!showLevels || !signal) return;

    const add = (price: number, color: string, title: string) => {
      priceLinesRef.current.push(
        series.createPriceLine({
          price,
          color,
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title,
        }),
      );
    };
    if (signal.entry_zone) {
      add(signal.entry_zone.low, VIZ.buy, "ENTRY");
      add(signal.entry_zone.high, VIZ.buy, "ENTRY");
    }
    if (signal.stop_loss) add(signal.stop_loss, VIZ.sell, "STOP");
    signal.take_profit.forEach((p, i) => add(p, VIZ.gold, `TP${i + 1}`));
  }, [signal, showLevels]);

  const applyBarData = useCallback(
    (bars: GoldOhlcBar[]) => {
      const candleData: BarPoint[] = bars.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));

      candleRef.current?.setData(candleData);
      volumeRef.current?.setData(
        bars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? "rgba(0,255,136,0.72)" : "rgba(255,51,85,0.72)",
        })),
      );

      if (showEma) {
        ema9Ref.current?.setData(
          computeEma(bars, 9).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
        );
        ema21Ref.current?.setData(
          computeEma(bars, 21).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
        );
      } else {
        ema9Ref.current?.setData([]);
        ema21Ref.current?.setData([]);
      }

      const rsi = computeRsi(bars, 14);
      rsiSeriesRef.current?.setData(
        rsi.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      setRsiLive(rsi.at(-1)?.value ?? null);

      const { macd, signal: macdSig, histogram } = computeMacd(bars);
      macdLineRef.current?.setData(
        macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      macdSignalRef.current?.setData(
        macdSig.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      macdHistRef.current?.setData(
        histogram.map((p) => ({
          time: p.time as UTCTimestamp,
          value: p.value,
          color: p.value >= 0 ? "rgba(0,255,136,0.8)" : "rgba(255,51,85,0.8)",
        })),
      );
      setMacdLive(macd.at(-1)?.value ?? null);

      const last = bars[bars.length - 1];
      setLastPrice(last.close);
      mainChartRef.current?.timeScale().fitContent();
      rsiChartRef.current?.timeScale().fitContent();
      macdChartRef.current?.timeScale().fitContent();
      applySignalLevels();
    },
    [showEma, applySignalLevels],
  );

  const loadBars = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/gold-signals/chart?interval=${chartInterval}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "chart failed");
        const bars = (data.bars ?? []) as GoldOhlcBar[];
        setBarCount(bars.length);
        if (bars.length === 0) throw new Error("no bars");
        lastBarsRef.current = bars;
        if (candleRef.current) applyBarData(bars);
      } catch (e) {
        setError(e instanceof Error ? e.message : "chart error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [chartInterval, applyBarData],
  );

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const mainChart = createChart(mainEl, {
      ...CHART_BASE,
      width: mainEl.clientWidth,
      height: mainEl.clientHeight,
      timeScale: { ...CHART_BASE.timeScale, secondsVisible: chartInterval === "1m" },
    });

    const candles = mainChart.addSeries(CandlestickSeries, {
      upColor: "#00ff88",
      downColor: "#ff3355",
      borderVisible: false,
      wickUpColor: "#00ff88",
      wickDownColor: "#ff3355",
    });
    const volume = mainChart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    mainChart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const ema9 = mainChart.addSeries(LineSeries, { color: VIZ.cyan, lineWidth: 2, title: "EMA9" });
    const ema21 = mainChart.addSeries(LineSeries, { color: VIZ.gold, lineWidth: 2, title: "EMA21" });

    mainChartRef.current = mainChart;
    candleRef.current = candles;
    volumeRef.current = volume;
    ema9Ref.current = ema9;
    ema21Ref.current = ema21;

    const charts: IChartApi[] = [mainChart];

    let rsiChart: IChartApi | null = null;
    let macdChart: IChartApi | null = null;

    if (rsiRef.current) {
      rsiChart = createChart(rsiRef.current, {
        ...CHART_BASE,
        width: rsiRef.current.clientWidth,
        height: rsiRef.current.clientHeight,
        timeScale: { ...CHART_BASE.timeScale, visible: false },
      });
      const rsiLine = rsiChart.addSeries(LineSeries, { color: VIZ.purple, lineWidth: 2, title: "RSI" });
      rsiLine.createPriceLine({ price: 70, color: "rgba(255,51,85,0.7)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
      rsiLine.createPriceLine({ price: 30, color: "rgba(0,255,136,0.7)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });
      rsiChartRef.current = rsiChart;
      rsiSeriesRef.current = rsiLine;
      charts.push(rsiChart);
    }

    if (macdRef.current) {
      macdChart = createChart(macdRef.current, {
        ...CHART_BASE,
        width: macdRef.current.clientWidth,
        height: macdRef.current.clientHeight,
        timeScale: { ...CHART_BASE.timeScale, visible: true },
      });
      const hist = macdChart.addSeries(HistogramSeries, { priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
      const macdLine = macdChart.addSeries(LineSeries, { color: VIZ.cyan, lineWidth: 2, title: "MACD" });
      const sigLine = macdChart.addSeries(LineSeries, { color: VIZ.orange, lineWidth: 2, title: "Signal" });
      macdChartRef.current = macdChart;
      macdHistRef.current = hist;
      macdLineRef.current = macdLine;
      macdSignalRef.current = sigLine;
      charts.push(macdChart);
    }

    syncCharts(mainChart, charts.filter((c) => c !== mainChart));
    if (rsiChart) syncCharts(rsiChart, charts.filter((c) => c !== rsiChart));
    if (macdChart) syncCharts(macdChart, charts.filter((c) => c !== macdChart));

    const ro = new ResizeObserver(() => {
      mainChart.applyOptions({ width: mainEl.clientWidth, height: mainEl.clientHeight });
      if (rsiRef.current && rsiChart)
        rsiChart.applyOptions({ width: rsiRef.current.clientWidth, height: rsiRef.current.clientHeight });
      if (macdRef.current && macdChart)
        macdChart.applyOptions({ width: macdRef.current.clientWidth, height: macdRef.current.clientHeight });
    });
    ro.observe(mainEl);
    if (rsiRef.current) ro.observe(rsiRef.current);
    if (macdRef.current) ro.observe(macdRef.current);

    return () => {
      ro.disconnect();
      mainChart.remove();
      rsiChart?.remove();
      macdChart?.remove();
      mainChartRef.current = null;
      rsiChartRef.current = null;
      macdChartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      ema9Ref.current = null;
      ema21Ref.current = null;
      rsiSeriesRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load after chart mount
  }, [chartInterval, showRsi, showMacd, syncCharts]);

  useEffect(() => {
    if (!mainChartRef.current) return;
    void loadBars(false);
    const timer = window.setInterval(() => void loadBars(true), chartInterval === "1m" ? 30_000 : 60_000);
    return () => clearInterval(timer);
  }, [loadBars, chartInterval, showRsi, showMacd]);

  useEffect(() => {
    applySignalLevels();
  }, [applySignalLevels]);

  useEffect(() => {
    if (lastBarsRef.current.length && candleRef.current) {
      applyBarData(lastBarsRef.current);
    }
  }, [showEma, applyBarData]);

  return (
    <div className={cn("flex h-full flex-col bg-[#050810]", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-sky-900/30 bg-gradient-to-r from-[#060a14] via-[#050810] to-[#060a14] px-3 py-2">
        <div className="flex gap-0.5 rounded-lg border border-white/[0.06] bg-black/50 p-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setChartInterval(iv)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase transition-colors",
                chartInterval === iv
                  ? "bg-accent/20 text-accent shadow-[0_0_12px_-4px_var(--accent-glow)]"
                  : "text-muted hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              {iv}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ToolToggle active={showLevels} onClick={() => setShowLevels((v) => !v)} label={t("goldSignals.toolLevels")} />
          <ToolToggle active={showEma} onClick={() => setShowEma((v) => !v)} label="EMA" />
          <ToolToggle active={showRsi} onClick={() => setShowRsi((v) => !v)} label="RSI" />
          <ToolToggle active={showMacd} onClick={() => setShowMacd((v) => !v)} label="MACD" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-sky-900/20 bg-[#040810]/80 px-3 py-2 font-mono text-[10px]">
        {lastPrice != null ? (
          <span className="text-sm font-semibold tabular-nums text-foreground">${lastPrice.toFixed(2)}</span>
        ) : null}
        {rsiLive != null ? (
          <span className={cn(rsiLive > 70 ? "text-[#ff4466]" : rsiLive < 30 ? "text-[#00ff88]" : "text-muted")}>
            RSI <span className="font-semibold">{rsiLive.toFixed(1)}</span>
          </span>
        ) : null}
        {macdLive != null ? (
          <span className={macdLive >= 0 ? "text-[#00ff88]" : "text-[#ff4466]"}>
            MACD{" "}
            <span className="font-semibold">
              {macdLive >= 0 ? "+" : ""}
              {macdLive.toFixed(2)}
            </span>
          </span>
        ) : null}
        <span className="text-muted">{barCount} bars · GC=F</span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-xs text-rose-300">
            {error}
          </div>
        ) : null}
        <div ref={mainRef} className="min-h-[200px] flex-[7]" />
        {showRsi ? <div ref={rsiRef} className="min-h-[72px] flex-[2] border-t border-white/[0.06]" /> : null}
        {showMacd ? <div ref={macdRef} className="min-h-[72px] flex-[2] border-t border-white/[0.06]" /> : null}
      </div>
    </div>
  );
}

function ToolToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
        active
          ? "border-accent/35 bg-accent/12 text-accent"
          : "border-white/[0.08] bg-transparent text-muted hover:border-white/15 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
