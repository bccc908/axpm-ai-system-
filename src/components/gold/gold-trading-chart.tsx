"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { Loader2, Maximize2, Radio, ZoomIn, ZoomOut } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { useGoldDesk } from "@/components/gold/gold-desk-context";
import { computeEma, computeMacd, computeRsi, patchFormingBar } from "@/lib/gold-signals/chart-math";
import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import { VIZ } from "@/lib/gold-signals/viz-colors";
import type { DeskSignal } from "@/lib/market-signals/instruments";
import { cn } from "@/lib/utils";

export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h";
export type ChartRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "max";

type BarPoint = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

const INTERVALS: ChartInterval[] = ["1m", "5m", "15m", "1h", "4h"];
const RANGES: { id: ChartRange; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "5d", label: "5D" },
  { id: "1mo", label: "1M" },
  { id: "3mo", label: "3M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "max", label: "ALL" },
];

const CHART_BASE = {
  layout: {
    background: { type: ColorType.Solid, color: "#171c2a" },
    textColor: "#8b95a5",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  grid: {
    vertLines: { color: "rgba(255, 255, 255, 0.04)" },
    horzLines: { color: "rgba(255, 255, 255, 0.04)" },
  },
  rightPriceScale: { borderColor: "#262d3d" },
  timeScale: { borderColor: "#262d3d", timeVisible: true },
  crosshair: { mode: 1 as const },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true,
  },
  handleScale: {
    mouseWheel: true,
    pinch: true,
    axisPressedMouseMove: { time: true, price: true },
    axisDoubleClickReset: { time: true, price: true },
  },
};

function adjustLogicalZoom(charts: IChartApi[], factor: number) {
  const main = charts[0];
  if (!main) return;
  const range = main.timeScale().getVisibleLogicalRange();
  if (!range) return;
  const span = range.to - range.from;
  const center = (range.from + range.to) / 2;
  const newSpan = Math.max(8, span * factor);
  const next = { from: center - newSpan / 2, to: center + newSpan / 2 };
  for (const chart of charts) {
    chart.timeScale().setVisibleLogicalRange(next);
  }
}

export function GoldTradingChart({
  signal,
  className,
}: {
  signal: DeskSignal | null;
  className?: string;
}) {
  const { t } = useLocale();
  const {
    apiBase,
    dataSource: defaultSource,
    structureBars,
    source: deskSource,
    wsConnected,
    livePrice,
  } = useGoldDesk();
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
  const fitOnNextDataRef = useRef(true);
  const lastBarsRef = useRef<GoldOhlcBar[]>([]);
  const livePriceRef = useRef<number | null>(null);
  const barsInflightRef = useRef(false);

  const [chartInterval, setChartInterval] = useState<ChartInterval>("5m");
  const [chartRange, setChartRange] = useState<ChartRange>("5d");
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
  const [dataSource, setDataSource] = useState(defaultSource);
  const [isLive, setIsLive] = useState(false);

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

  const allCharts = useCallback(
    () =>
      [mainChartRef.current, rsiChartRef.current, macdChartRef.current].filter(
        (c): c is IChartApi => c != null,
      ),
    [],
  );

  const resetZoom = useCallback(() => {
    fitOnNextDataRef.current = true;
    for (const chart of allCharts()) {
      chart.timeScale().fitContent();
      chart.priceScale("right").applyOptions({ autoScale: true });
    }
    fitOnNextDataRef.current = false;
  }, [allCharts]);

  const zoomIn = useCallback(() => {
    adjustLogicalZoom(allCharts(), 0.72);
  }, [allCharts]);

  const zoomOut = useCallback(() => {
    adjustLogicalZoom(allCharts(), 1.38);
  }, [allCharts]);

  const scrollToRealtime = useCallback(() => {
    for (const chart of allCharts()) {
      chart.timeScale().scrollToRealTime();
    }
  }, [allCharts]);

  const pushSeriesUpdate = useCallback((bars: GoldOhlcBar[]) => {
    const last = bars.at(-1);
    if (!last) return;

    const t = last.time as UTCTimestamp;
    candleRef.current?.update({
      time: t,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });
    volumeRef.current?.update({
      time: t,
      value: last.volume,
      color: last.close >= last.open ? "rgba(46,189,133,0.72)" : "rgba(239,83,80,0.72)",
    });

    if (showEma) {
      const ema9 = computeEma(bars, 9).at(-1);
      const ema21 = computeEma(bars, 21).at(-1);
      if (ema9) ema9Ref.current?.update({ time: ema9.time as UTCTimestamp, value: ema9.value });
      if (ema21) ema21Ref.current?.update({ time: ema21.time as UTCTimestamp, value: ema21.value });
    }

    const rsi = computeRsi(bars, 14).at(-1);
    if (rsi) {
      rsiSeriesRef.current?.update({ time: rsi.time as UTCTimestamp, value: rsi.value });
      setRsiLive(rsi.value);
    }

    const { macd, signal: macdSig, histogram } = computeMacd(bars);
    const m = macd.at(-1);
    const s = macdSig.at(-1);
    const h = histogram.at(-1);
    if (m) macdLineRef.current?.update({ time: m.time as UTCTimestamp, value: m.value });
    if (s) macdSignalRef.current?.update({ time: s.time as UTCTimestamp, value: s.value });
    if (h) {
      macdHistRef.current?.update({
        time: h.time as UTCTimestamp,
        value: h.value,
        color: h.value >= 0 ? "rgba(46,189,133,0.8)" : "rgba(239,83,80,0.8)",
      });
    }
    if (m) setMacdLive(m.value);
    setLastPrice(last.close);
  }, [showEma]);

  const applyBarData = useCallback(
    (bars: GoldOhlcBar[], options?: { forceFit?: boolean; streaming?: boolean }) => {
      if (options?.streaming) {
        lastBarsRef.current = bars;
        pushSeriesUpdate(bars);
        applySignalLevels();
        return;
      }

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
          color: b.close >= b.open ? "rgba(46,189,133,0.72)" : "rgba(239,83,80,0.72)",
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
          color: p.value >= 0 ? "rgba(46,189,133,0.8)" : "rgba(239,83,80,0.8)",
        })),
      );
      setMacdLive(macd.at(-1)?.value ?? null);

      const last = bars[bars.length - 1];
      setLastPrice(last.close);
      lastBarsRef.current = bars;
      const shouldFit = options?.forceFit || fitOnNextDataRef.current;
      if (shouldFit) {
        mainChartRef.current?.timeScale().fitContent();
        rsiChartRef.current?.timeScale().fitContent();
        macdChartRef.current?.timeScale().fitContent();
        fitOnNextDataRef.current = false;
      }
      applySignalLevels();
    },
    [showEma, applySignalLevels, pushSeriesUpdate],
  );

  const applyLiveQuote = useCallback(
    (price: number) => {
      if (!lastBarsRef.current.length) return;
      const patched = patchFormingBar(lastBarsRef.current, price);
      if (patched === lastBarsRef.current) return;
      lastBarsRef.current = patched;
      pushSeriesUpdate(patched);
    },
    [pushSeriesUpdate],
  );

  const loadBars = useCallback(
    async (silent = false) => {
      if (barsInflightRef.current) return;
      barsInflightRef.current = true;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBase}/chart?interval=${chartInterval}&range=${chartRange}&_=${Date.now()}`,
          { cache: "no-store", credentials: "include" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "chart failed");
        const bars = (data.bars ?? []) as GoldOhlcBar[];
        setBarCount(bars.length);
        if (bars.length === 0) throw new Error("no bars");
        setDataSource(data.source ?? defaultSource);

        const prev = lastBarsRef.current;
        const prevLast = prev.at(-1);
        const nextLast = bars.at(-1);
        lastBarsRef.current = bars;

        if (candleRef.current) {
          if (
            silent &&
            prev.length > 0 &&
            prevLast &&
            nextLast &&
            prev.length === bars.length &&
            prevLast.time === nextLast.time
          ) {
            applyBarData(bars, { streaming: true });
          } else if (
            silent &&
            prev.length > 0 &&
            nextLast &&
            prevLast &&
            nextLast.time > prevLast.time
          ) {
            applyBarData(bars, { streaming: true });
            for (let i = prev.length; i < bars.length - 1; i++) {
              const b = bars[i];
              const t = b.time as UTCTimestamp;
              candleRef.current.update({
                time: t,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
              });
            }
            pushSeriesUpdate(bars);
          } else {
            applyBarData(bars);
          }
        }

        if (nextLast) {
          livePriceRef.current = nextLast.close;
          setLastPrice(nextLast.close);
        }
      } catch (e) {
        if (structureBars.length > 0) {
          const bars = structureBars as GoldOhlcBar[];
          setBarCount(bars.length);
          setDataSource(deskSource ?? "Binance WS");
          setError(null);
          lastBarsRef.current = bars;
          applyBarData(bars);
          const nextLast = bars.at(-1);
          if (nextLast) {
            livePriceRef.current = nextLast.close;
            setLastPrice(nextLast.close);
          }
          setIsLive(wsConnected);
        } else {
          setError(e instanceof Error ? e.message : "chart error");
        }
      } finally {
        barsInflightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [apiBase, chartInterval, chartRange, applyBarData, pushSeriesUpdate, defaultSource, structureBars, deskSource, wsConnected],
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
      upColor: "#2ebd85",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#2ebd85",
      wickDownColor: "#ef5350",
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
      rsiLine.createPriceLine({ price: 70, color: "rgba(239,83,80,0.7)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
      rsiLine.createPriceLine({ price: 30, color: "rgba(46,189,133,0.7)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });
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
    fitOnNextDataRef.current = true;
  }, [chartInterval, chartRange]);

  useEffect(() => {
    if (!mainChartRef.current) return;
    const useDesk1m = chartInterval === "1m" && structureBars.length > 0;
    if (!useDesk1m) void loadBars(false);
    const barPoll = window.setInterval(() => {
      if (chartInterval === "1m" && structureBars.length > 0) return;
      void loadBars(true);
    }, chartInterval === "1m" ? 15_000 : 30_000);
    return () => clearInterval(barPoll);
  }, [loadBars, chartInterval, chartRange, showRsi, showMacd, structureBars.length]);

  useEffect(() => {
    if (livePrice == null) return;
    livePriceRef.current = livePrice;
    setIsLive(true);
    applyLiveQuote(livePrice);
    setLastPrice(livePrice);
  }, [livePrice, applyLiveQuote]);

  useEffect(() => {
    if (!wsConnected || structureBars.length === 0 || !candleRef.current) return;
    if (chartInterval !== "1m" && chartInterval !== "5m") return;
    const bars = structureBars as GoldOhlcBar[];
    setBarCount(bars.length);
    setDataSource(deskSource ?? "Binance WS");
    setError(null);
    setIsLive(true);
    lastBarsRef.current = bars;
    applyBarData(bars, { streaming: true });
    const last = bars.at(-1);
    if (last) {
      livePriceRef.current = last.close;
      setLastPrice(last.close);
    }
  }, [structureBars, wsConnected, deskSource, chartInterval, applyBarData]);

  useEffect(() => {
    applySignalLevels();
  }, [applySignalLevels]);

  useEffect(() => {
    if (lastBarsRef.current.length && candleRef.current) {
      applyBarData(lastBarsRef.current);
    }
  }, [showEma, applyBarData]);

  return (
    <div className={cn("flex h-full flex-col bg-[#171c2a]", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-card-border bg-surface px-3 py-2">
        <div className="flex gap-0.5 rounded-lg border border-white/[0.06] bg-black/50 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setChartRange(r.id)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase transition-colors",
                chartRange === r.id
                  ? "bg-sky-500/15 text-sky-300"
                  : "text-muted hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 rounded-lg border border-white/[0.06] bg-black/50 p-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setChartInterval(iv)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase transition-colors",
                chartInterval === iv
                  ? "bg-accent/20 text-accent"
                  : "text-muted hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              {iv}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-black/50 p-0.5">
            <ZoomButton title={t("goldSignals.zoomIn")} onClick={zoomIn}>
              <ZoomIn className="h-3.5 w-3.5" />
            </ZoomButton>
            <ZoomButton title={t("goldSignals.zoomOut")} onClick={zoomOut}>
              <ZoomOut className="h-3.5 w-3.5" />
            </ZoomButton>
            <ZoomButton title={t("goldSignals.zoomReset")} onClick={resetZoom}>
              <Maximize2 className="h-3.5 w-3.5" />
            </ZoomButton>
            <ZoomButton title={t("goldSignals.goRealtime")} onClick={scrollToRealtime}>
              <Radio className="h-3.5 w-3.5" />
            </ZoomButton>
          </div>
          <ToolToggle active={showLevels} onClick={() => setShowLevels((v) => !v)} label={t("goldSignals.toolLevels")} />
          <ToolToggle active={showEma} onClick={() => setShowEma((v) => !v)} label="EMA" />
          <ToolToggle active={showRsi} onClick={() => setShowRsi((v) => !v)} label="RSI" />
          <ToolToggle active={showMacd} onClick={() => setShowMacd((v) => !v)} label="MACD" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-card-border bg-[#171c2a]/80 px-3 py-2 font-mono text-[10px]">
        {lastPrice != null ? (
          <span className="text-sm font-semibold tabular-nums text-foreground">${lastPrice.toFixed(2)}</span>
        ) : null}
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {t("goldSignals.chartLive")}
          </span>
        ) : null}
        {rsiLive != null ? (
          <span className={cn(rsiLive > 70 ? "text-[#ef5350]" : rsiLive < 30 ? "text-[#2ebd85]" : "text-muted")}>
            RSI <span className="font-semibold">{rsiLive.toFixed(1)}</span>
          </span>
        ) : null}
        {macdLive != null ? (
          <span className={macdLive >= 0 ? "text-[#2ebd85]" : "text-[#ef5350]"}>
            MACD{" "}
            <span className="font-semibold">
              {macdLive >= 0 ? "+" : ""}
              {macdLive.toFixed(2)}
            </span>
          </span>
        ) : null}
        <span className="text-muted">
          {barCount} bars · {dataSource} · {t("goldSignals.chartEngine")}
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-xs text-danger">
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

function ZoomButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
    >
      {children}
    </button>
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
