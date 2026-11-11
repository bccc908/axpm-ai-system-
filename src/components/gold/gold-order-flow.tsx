"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { useGoldDesk } from "@/components/gold/gold-desk-context";
import {
  aggregateFlowByPrice,
  barBuySellVolume,
  buildBarFlowFromBars,
  cumulativeDelta,
  footprintGrid,
  footprintStableRange,
  type BarFlowRow,
} from "@/lib/gold-signals/order-flow";
import { buildLadderItems } from "@/lib/gold-signals/ladder-display";
import { VIZ } from "@/lib/gold-signals/viz-colors";
import { cn } from "@/lib/utils";
import type { DeskSignal } from "@/lib/market-signals/instruments";

const BG = VIZ.bg;

function formatBarTime(ts: number, locale: string) {
  return new Date(ts * 1000).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatVol(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function secondsAgo(updatedAt: string | null, clock: number) {
  void clock;
  if (!updatedAt) return null;
  const sec = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000));
  return sec;
}

export function GoldOrderFlowViz({
  signal,
  className,
}: {
  signal: DeskSignal | null;
  className?: string;
}) {
  const { t, locale } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef(0);
  const rangeRef = useRef({ anchor: "", priceMin: 0, priceMax: 0 });
  const { structureBars, loading, error, source, stale, updatedAt, livePrice, structureLastBar, flashKey, clock, reload, priceTick } =
    useGoldDesk();

  const entryLo = signal?.entry_zone?.low ?? null;
  const entryHi = signal?.entry_zone?.high ?? null;

  const stableRange = useMemo(() => {
    const last = structureBars.at(-1);
    const anchor = `${structureBars.length}-${last?.time ?? 0}-${signal?.id ?? ""}`;
    if (anchor === rangeRef.current.anchor) {
      return { priceMin: rangeRef.current.priceMin, priceMax: rangeRef.current.priceMax, anchor };
    }
    const next = footprintStableRange(structureBars, {
      entryLo,
      entryHi,
      stop: signal?.stop_loss ?? null,
      targets: signal?.take_profit ?? [],
    });
    rangeRef.current = { anchor, priceMin: next.priceMin, priceMax: next.priceMax };
    return { ...next, anchor };
  }, [structureBars, entryLo, entryHi, signal?.id, signal?.stop_loss, signal?.take_profit]);

  const barFlow = useMemo(() => {
    const rows = buildBarFlowFromBars(structureBars);
    if (rows.length === 0 || livePrice == null || structureLastBar == null) return rows;
    if (rows[0].time !== structureLastBar.time) return rows;
    const raw = structureLastBar;
    const patched = { ...raw, close: livePrice };
    const { buyVol, sellVol } = barBuySellVolume(patched);
    const delta = buyVol - sellVol;
    return [
      {
        ...rows[0],
        close: livePrice,
        buyVol,
        sellVol,
        delta,
        side: (delta >= 0 ? "buy" : "sell") as BarFlowRow["side"],
      },
      ...rows.slice(1),
    ];
  }, [structureBars, livePrice, structureLastBar]);

  const cumDelta = useMemo(() => cumulativeDelta(barFlow), [barFlow]);
  const byPrice = useMemo(
    () => aggregateFlowByPrice(structureBars, entryLo, entryHi),
    [structureBars, entryLo, entryHi],
  );
  const clusters = useMemo(() => {
    const maxVol = Math.max(1, ...byPrice.map((r) => r.buyVol + r.sellVol));
    return byPrice
      .filter((r) => (r.buyVol + r.sellVol) / maxVol > 0.35 || r.barCount >= 3)
      .slice(0, 8);
  }, [byPrice]);

  const ago = secondsAgo(updatedAt, clock);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || structureBars.length < 4) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(400, rect.width);
    const h = Math.max(260, rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cols = 28;
    const { colTimes, cells } = footprintGrid(structureBars, cols, stableRange);
    const { priceMin, priceMax } = stableRange;
    if (colTimes.length === 0) return;

    const tick = priceTick;
    const rows = Math.ceil((priceMax - priceMin) / tick);

    const left = 44;
    const top = 28;
    const chartW = w - left - 8;
    const chartH = h - top - 16;
    const cellW = chartW / colTimes.length;
    const cellH = chartH / rows;
    const priceToRow = (p: number) => Math.round((p - priceMin) / tick);

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    if (entryLo != null && entryHi != null) {
      const y1 = top + chartH - priceToRow(entryHi) * cellH;
      const y2 = top + chartH - priceToRow(entryLo) * cellH;
      ctx.fillStyle = "rgba(255, 204, 0, 0.14)";
      ctx.fillRect(left, y1, chartW, y2 - y1);
      ctx.strokeStyle = "rgba(255, 204, 0, 0.55)";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(left, y1, chartW, y2 - y1);
      ctx.setLineDash([]);
    }

    let maxCell = 1;
    for (const vol of cells.values()) {
      maxCell = Math.max(maxCell, vol.buy + vol.sell);
    }

    const lastCol = colTimes.length - 1;

    for (const [key, vol] of cells) {
      const [colStr, rowStr] = key.split(":");
      const col = Number(colStr);
      const row = priceToRow(Number(rowStr));
      const x = left + col * cellW;
      const y = top + chartH - (row + 1) * cellH;
      const total = vol.buy + vol.sell;
      if (total < 0.5) continue;

      const intensity = Math.min(1, total / maxCell);
      const isLiveCol = col === lastCol;
      const pulse = pulseRef.current;
      if (vol.buy >= vol.sell) {
        const a = 0.22 + intensity * 0.58 + (isLiveCol ? pulse * 0.12 : 0);
        ctx.fillStyle = `rgba(0, 255, 136, ${Math.min(0.95, a)})`;
      } else {
        const a = 0.22 + intensity * 0.58 + (isLiveCol ? pulse * 0.12 : 0);
        ctx.fillStyle = `rgba(255, 51, 85, ${Math.min(0.95, a)})`;
      }
      ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

      if (cellH >= 10 && cellW >= 12 && total >= maxCell * 0.08) {
        ctx.font = "7px ui-monospace, monospace";
        ctx.textAlign = "center";
        if (vol.buy > 0) {
          ctx.fillStyle = VIZ.cyanBright;
          ctx.fillText(formatVol(vol.buy), x + cellW * 0.3, y + cellH * 0.55);
        }
        if (vol.sell > 0) {
          ctx.fillStyle = "#ff8899";
          ctx.fillText(formatVol(vol.sell), x + cellW * 0.72, y + cellH * 0.85);
        }
        ctx.textAlign = "left";
      }
    }

    const levels: Array<{ p: number; label: string; color: string }> = [];
    if (signal?.stop_loss) levels.push({ p: signal.stop_loss, label: "STOP", color: VIZ.sell });
    if (entryLo) levels.push({ p: entryLo, label: "ENTRY", color: VIZ.buy });
    if (entryHi) levels.push({ p: entryHi, label: "ENTRY", color: VIZ.buy });
    signal?.take_profit.forEach((p, i) => levels.push({ p, label: `TP${i + 1}`, color: VIZ.gold }));

    for (const lv of levels) {
      const row = priceToRow(lv.p);
      const y = top + chartH - row * cellH;
      ctx.strokeStyle = lv.color;
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = lv.color;
      ctx.font = "bold 7px ui-monospace, monospace";
      ctx.fillText(lv.label, 4, y - 2);
    }

    const spot = livePrice ?? signal?.spot_price;
    if (spot) {
      const y = top + chartH - priceToRow(spot) * cellH;
      const pulse = pulseRef.current;
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.55 + pulse * 0.45})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + chartW, y);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = VIZ.cyanBright;
      ctx.font = "bold 8px ui-monospace, monospace";
      ctx.fillText(spot.toFixed(2), left + chartW - 44, y - 3);
    }

    ctx.strokeStyle = "rgba(56, 100, 140, 0.12)";
    for (let c = 0; c <= colTimes.length; c++) {
      const x = left + c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + chartH);
      ctx.stroke();
    }

    ctx.fillStyle = VIZ.cyan;
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.fillText("FOOTPRINT · 1M BAR DELTA", left, 12);

    ctx.fillStyle = "rgba(140, 175, 210, 0.55)";
    ctx.font = "8px ui-monospace, monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const p = priceMax - (i / 5) * (priceMax - priceMin);
      const y = top + chartH - priceToRow(p) * cellH;
      ctx.fillText(p.toFixed(1), left - 4, y + 3);
    }
    ctx.textAlign = "left";
  }, [structureBars, stableRange, signal, entryLo, entryHi, livePrice]);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      pulseRef.current = (Math.sin(performance.now() / 380) + 1) / 2;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(draw);
    const el = canvasRef.current;
    if (el) ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [draw]);

  if (loading && structureBars.length === 0) {
    return (
      <div className={cn("flex h-full items-center justify-center gap-2 text-sm text-muted", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
        {t("goldSignals.loading")}
      </div>
    );
  }

  if (!loading && structureBars.length < 4) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center gap-3 px-6 text-center", className)}>
        <p className="text-sm text-muted">{t("goldSignals.orderFlowNoData")}</p>
        {error ? (
          <p className="max-w-md text-[11px] text-danger/80">{t("goldSignals.orderFlowError")}</p>
        ) : null}
        <button
          type="button"
          onClick={() => reload()}
          className="rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
        >
          {t("goldSignals.refresh")}
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#262d3d] bg-[#171c2a] px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-success">
            {t("goldSignals.orderFlowLive")}
          </span>
        </span>
        {livePrice != null ? (
          <span className="font-mono text-[11px] font-semibold tabular-nums text-sky-200">
            {livePrice.toFixed(2)}
          </span>
        ) : null}
        {ago != null ? (
          <span className="text-[10px] text-muted">
            {t("goldSignals.orderFlowUpdated", { sec: String(ago) })}
          </span>
        ) : null}
        <Info className="h-3.5 w-3.5 shrink-0 text-amber-400/90" />
        <p className="min-w-[120px] flex-1 text-[10px] leading-snug text-amber-200/75">
          {stale ? t("goldSignals.orderFlowStaleDisclaimer") : t("goldSignals.orderFlowDisclaimer")}
          {source ? ` · ${source}` : ""}
        </p>
        <span
          className={cn(
            "shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums transition-colors duration-300",
            cumDelta >= 0
              ? "border-emerald-500/35 bg-emerald-500/10 text-success"
              : "border-rose-500/35 bg-rose-500/10 text-danger",
          )}
        >
          Δ {cumDelta >= 0 ? "+" : ""}
          {formatVol(cumDelta)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[240px] flex-1">
          <canvas ref={canvasRef} className="h-full w-full" style={{ background: BG, display: "block" }} />
          {clusters.length > 0 ? (
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
              {clusters.map((c) => (
                <span
                  key={c.price}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[9px] transition-all duration-300",
                    c.inEntryZone
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                      : c.lastSide === "buy"
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                        : "border-rose-500/30 bg-rose-500/10 text-danger",
                  )}
                >
                  {c.price.toFixed(2)} · {c.lastSide === "buy" ? "B" : "S"}{" "}
                  {formatVol(c.buyVol + c.sellVol)}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <BarFlowTape
          rows={barFlow.slice(0, 60)}
          locale={locale}
          entryLo={entryLo}
          entryHi={entryHi}
          flashKey={flashKey}
          formingBarTime={structureLastBar?.time ?? null}
        />
      </div>
    </div>
  );
}

const HIDE_EMPTY_KEY = "axpm.goldSignals.ladder.hideEmpty";

/** "Hide empty prices" preference — defaults ON, persisted in localStorage. */
function useHideEmptyPrices(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(true);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HIDE_EMPTY_KEY);
      if (raw === "0") setValue(false);
    } catch {
      /* storage unavailable — keep default */
    }
  }, []);
  const update = useCallback((v: boolean) => {
    setValue(v);
    try {
      window.localStorage.setItem(HIDE_EMPTY_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);
  return [value, update];
}

export function GoldOrderFlowByPrice({ signal }: { signal: DeskSignal | null }) {
  const { t } = useLocale();
  const { structureBars } = useGoldDesk();
  const [hideEmpty, setHideEmpty] = useHideEmptyPrices();
  const entryLo = signal?.entry_zone?.low ?? null;
  const entryHi = signal?.entry_zone?.high ?? null;

  const levels = useMemo(
    () => aggregateFlowByPrice(structureBars, entryLo, entryHi),
    [structureBars, entryLo, entryHi],
  );
  const items = useMemo(
    () => buildLadderItems(levels, hideEmpty, entryLo, entryHi),
    [levels, hideEmpty, entryLo, entryHi],
  );

  const maxVol = Math.max(1, ...levels.map((r) => r.buyVol + r.sellVol));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-end border-b border-card-border px-2 py-1">
        <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[10px] font-medium text-muted hover:text-foreground">
          <span>{t("goldSignals.hideEmptyPrices")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={hideEmpty}
            aria-label={t("goldSignals.hideEmptyPrices")}
            onClick={() => setHideEmpty(!hideEmpty)}
            className={cn(
              "relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full border transition-colors",
              hideEmpty ? "border-accent bg-accent" : "border-border-strong bg-surface-3",
            )}
          >
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform",
                hideEmpty ? "translate-x-[11px]" : "translate-x-[1px]",
              )}
            />
          </button>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[10px]">
        {items.length === 0 ? (
          <p className="p-6 text-center text-muted">—</p>
        ) : (
          items.map((item) => {
            if (item.kind === "gap") {
              return (
                <div
                  key={`gap-${item.from}`}
                  className="flex items-center gap-2 border-b border-card-border/60 bg-background/60 px-2 py-0.5 text-[9px] text-muted/80"
                  title={t("goldSignals.emptyPricesSkipped", { count: String(item.count) })}
                >
                  <span className="h-px flex-1 bg-card-border" />
                  <span className="tabular-nums">
                    {item.from.toFixed(2)}–{item.to.toFixed(2)}
                  </span>
                  <span className="text-muted/60">
                    · {t("goldSignals.emptyPricesSkipped", { count: String(item.count) })}
                  </span>
                  <span className="h-px flex-1 bg-card-border" />
                </div>
              );
            }
            const row = item.row;
            if (item.empty) {
              return (
                <div
                  key={row.price}
                  className={cn(
                    "border-b border-white/[0.03] px-2 py-1 text-muted/60",
                    row.inEntryZone && "bg-amber-500/10",
                  )}
                >
                  <span className="tabular-nums">{row.price.toFixed(2)}</span>
                </div>
              );
            }
            const buyPct = (row.buyVol / maxVol) * 100;
            const sellPct = (row.sellVol / maxVol) * 100;
            return (
              <div
                key={row.price}
                className={cn(
                  "border-b border-white/[0.03] px-2 py-1.5 transition-colors duration-300",
                  row.inEntryZone && "bg-amber-500/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("tabular-nums font-semibold", row.inEntryZone && "text-amber-200")}>
                    {row.price.toFixed(2)}
                  </span>
                  <span className="text-muted">{row.barCount} bars</span>
                </div>
                <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="bg-[#2ebd85]/80 transition-all duration-500"
                    style={{ width: `${buyPct}%` }}
                  />
                  <div
                    className="bg-[#ef5350]/80 transition-all duration-500"
                    style={{ width: `${sellPct}%` }}
                  />
                </div>
                <div className="mt-0.5 flex justify-between text-[9px]">
                  <span className="font-semibold text-[#2ebd85]">
                    {t("goldSignals.orderFlowBuy")} {formatVol(row.buyVol)}
                  </span>
                  <span className="font-semibold text-[#ef5350]">
                    {t("goldSignals.orderFlowSell")} {formatVol(row.sellVol)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function BarFlowTape({
  rows,
  locale,
  entryLo,
  entryHi,
  flashKey,
  formingBarTime,
}: {
  rows: BarFlowRow[];
  locale: string;
  entryLo: number | null;
  entryHi: number | null;
  flashKey: number;
  formingBarTime: number | null;
}) {
  const { t } = useLocale();

  return (
    <div className="flex w-full shrink-0 flex-col border-t border-[#262d3d] bg-[#171c2a] lg:w-[220px] lg:border-l lg:border-t-0">
      <div className="border-b border-[#262d3d] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300/90">
          {t("goldSignals.orderFlowTape")}
        </p>
        <p className="mt-0.5 text-[9px] text-muted">{t("goldSignals.orderFlowHint")}</p>
      </div>
      <div className="grid shrink-0 grid-cols-[auto_1fr_auto_auto] gap-x-2 border-b border-[#262d3d] px-2 py-1.5 font-mono text-[8px] uppercase tracking-wider text-muted">
        <span>{t("goldSignals.orderFlowTime")}</span>
        <span>{t("goldSignals.orderFlowDelta")}</span>
        <span className="text-right">{t("goldSignals.price")}</span>
        <span className="text-right">{t("goldSignals.orderFlowVol")}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[10px]">
        {rows.length === 0 ? (
          <p className="p-4 text-center text-muted">—</p>
        ) : (
          rows.map((r, idx) => {
            const inEntry =
              entryLo != null && entryHi != null && r.close >= entryLo && r.close <= entryHi;
            const bullish = r.close >= r.open;
            const isForming = r.time === formingBarTime;
            const isFresh = idx === 0 && flashKey > 0;
            return (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[auto_1fr_auto_auto] gap-x-2 border-b border-white/[0.03] px-2 py-1 transition-colors duration-500",
                  inEntry && "bg-amber-500/8",
                  isForming && "bg-sky-500/10",
                  isFresh && "animate-[gold-tape-flash_0.8s_ease-out]",
                )}
              >
                <span className="text-muted">
                  {formatBarTime(r.time, locale)}
                  {isForming ? (
                    <span className="ml-1 text-[8px] text-sky-400">●</span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    r.delta >= 0 ? "text-[#2ebd85]" : "text-[#ef5350]",
                  )}
                >
                  {r.delta >= 0 ? "+" : ""}
                  {formatVol(r.delta)}
                </span>
                <span
                  className={cn(
                    "text-right tabular-nums",
                    inEntry && "font-bold text-amber-200",
                    !inEntry && (bullish ? "text-success/90" : "text-danger/90"),
                  )}
                >
                  {r.close.toFixed(2)}
                </span>
                <span className="text-right tabular-nums text-foreground/70">{formatVol(r.volume)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
