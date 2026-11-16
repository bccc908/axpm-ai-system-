"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { useGoldDesk } from "@/components/gold/gold-desk-context";
import { useDeskBookDepth } from "@/components/gold/use-gold-book-depth";
import {
  aggregateCloseFlow,
  aggregateFlowByPrice,
  barBuySellVolume,
  buildBarFlowFromBars,
  cumulativeDelta,
  type BarFlowRow,
} from "@/lib/gold-signals/order-flow";
import { formatLots, tapeLotVolume } from "@/lib/gold-signals/lot-size";
import { buildLadderItems } from "@/lib/gold-signals/ladder-display";
import { cn } from "@/lib/utils";
import type { DeskSignal } from "@/lib/market-signals/instruments";

function formatVol(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function formatDomVol(n: number) {
  if (n <= 0) return "";
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(k >= 2 ? 1 : 3).replace(/0+$/, "").replace(/\.$/, "")}K`;
  }
  return String(Math.round(n));
}

function snapTick(price: number, tick: number) {
  return Math.round(price / tick) * tick;
}

function formatPx(n: number, tick: number) {
  if (tick >= 10) return n.toFixed(0);
  if (tick >= 1) return n.toFixed(1);
  if (tick >= 0.01) return n.toFixed(2);
  return n.toFixed(3);
}

function formatDepthUsd(n: number) {
  if (!(n > 0)) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function secondsAgo(updatedAt: string | null, clock: number) {
  void clock;
  if (!updatedAt) return null;
  const sec = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000));
  return sec;
}

function isMetalDesk(instrument: string) {
  return instrument === "gold" || instrument === "xag" || instrument === "xau" || instrument === "spread";
}

function sameBookBars<T extends { close: number; high: number; low: number }>(
  bars: T[],
  instrument: string,
  spot?: number | null,
): T[] {
  if (!isMetalDesk(instrument) || bars.length < 4) return bars;
  const body = bars.slice(0, -1);
  const mid = body
    .map((b) => b.close)
    .slice(-20)
    .sort((a, b) => a - b)[Math.floor(Math.min(20, body.length) / 2)];
  if (!Number.isFinite(mid)) return bars;
  const anchor =
    spot != null && Number.isFinite(spot) && Math.abs(spot - mid) < 90 ? spot : mid;
  const kept = bars.filter(
    (b) =>
      Math.abs(b.close - anchor) < 90 &&
      Math.abs(b.high - anchor) < 110 &&
      Math.abs(b.low - anchor) < 110,
  );
  return kept.length >= 4 ? kept : bars;
}

const DOM_COLS =
  "grid grid-cols-[minmax(72px,1fr)_52px_68px_54px_34px_34px_54px_40px_28px_70px_62px_88px] items-center";
const DOM_ROW_H = 16;
const DOM_MIN_ROWS = 80;
const DOM_MAX_ROWS = 400;

export function GoldOrderFlowViz({
  signal,
  className,
}: {
  signal: DeskSignal | null;
  className?: string;
}) {
  const { t } = useLocale();
  const {
    structureBars,
    liveBars,
    loading,
    error,
    updatedAt,
    livePrice,
    clock,
    flashKey,
    reload,
    instrument,
    priceTick,
    source,
    dataSource,
    refreshEpoch,
  } = useGoldDesk();
  const { book, error: l2Error, prints: spotPrints } = useDeskBookDepth(instrument, true, refreshEpoch);
  void signal;

  const tapeBars = useMemo(
    () => sameBookBars(liveBars.length >= 4 ? liveBars : structureBars, instrument, livePrice),
    [liveBars, structureBars, instrument, livePrice],
  );
  const tapeAnchor = useMemo(() => {
    const closes = tapeBars.slice(-20).map((b) => b.close).filter(Number.isFinite);
    if (!closes.length) return null;
    return [...closes].sort((a, b) => a - b)[Math.floor(closes.length / 2)] ?? null;
  }, [tapeBars]);
  const liveBand =
    tapeAnchor == null
      ? 8
      : isMetalDesk(instrument)
        ? 90
        : Math.max(priceTick * 12, tapeAnchor * 0.02);
  const markOnTape =
    livePrice != null && (tapeAnchor == null || Math.abs(livePrice - tapeAnchor) < liveBand)
      ? livePrice
      : (tapeBars.at(-1)?.close ?? tapeAnchor ?? livePrice);
  const newestPrint = spotPrints[0];
  const quoteMs = updatedAt ? Date.parse(updatedAt) : 0;
  const printIsNewer =
    newestPrint != null &&
    Number.isFinite(newestPrint.px) &&
    Number.isFinite(quoteMs) &&
    newestPrint.time > quoteMs + 200;
  const shownPx = printIsNewer ? newestPrint.px : (livePrice ?? newestPrint?.px ?? markOnTape);
  const bookMark = shownPx ?? livePrice ?? markOnTape;

  const tick = isMetalDesk(instrument)
    ? priceTick >= 0.1
      ? 0.25
      : Math.max(priceTick, 0.01)
    : Math.max(priceTick, 0.01);

  const hitsRef = useRef(new Map<number, { buy: number; sell: number; at: number; last: number; side: "buy" | "sell" }>());
  const prevPxRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastRowRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const didCenterRef = useRef(false);
  const [ladder, setLadder] = useState<{ min: number; max: number } | null>(null);
  const [hitRev, setHitRev] = useState(0);
  const [bodyH, setBodyH] = useState(720);
  const [liveTicks, setLiveTicks] = useState<
    Array<{ id: string; time: number; close: number; volume: number; delta: number; side: "buy" | "sell" }>
  >([]);

  useEffect(() => {
    if (shownPx == null) return;
    const prev = prevPxRef.current;
    prevPxRef.current = shownPx;
    if (prev == null || Math.abs(shownPx - prev) < 0.001) return;
    const key = snapTick(shownPx, tick);
    const up = shownPx >= prev;
    const size = Math.max(1, Math.round((Math.abs(shownPx - prev) / tick) * 6));
    const cur = hitsRef.current.get(key) ?? { buy: 0, sell: 0, at: 0, last: shownPx, side: "buy" as const };
    if (up) cur.buy += size;
    else cur.sell += size;
    cur.at = Date.now();
    cur.last = shownPx;
    cur.side = up ? "buy" : "sell";
    hitsRef.current.set(key, cur);
    if (hitsRef.current.size > 80) {
      const oldest = [...hitsRef.current.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) hitsRef.current.delete(oldest[0]);
    }
    setLiveTicks((rows) =>
      [
        {
          id: `lt-${cur.at}-${key}`,
          time: cur.at,
          close: shownPx,
          volume: size,
          delta: up ? size : -size,
          side: (up ? "buy" : "sell") as "buy" | "sell",
        },
        ...rows,
      ].slice(0, 120),
    );
    setHitRev((n) => n + 1);
  }, [shownPx, tick]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const sync = () => setBodyH(el.clientHeight || 720);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const barFlow = useMemo(() => {
    const rows = buildBarFlowFromBars(tapeBars);
    if (rows.length === 0 || markOnTape == null) return rows;
    if (Math.abs(markOnTape - rows[0].close) < tick * 0.5) return rows;
    const lastBar = tapeBars.at(-1);
    if (!lastBar) return rows;
    const patched = { ...lastBar, close: markOnTape };
    const { buyVol, sellVol } = barBuySellVolume(patched);
    const delta = buyVol - sellVol;
    return [
      {
        ...rows[0],
        close: markOnTape,
        buyVol,
        sellVol,
        delta,
        side: (delta >= 0 ? "buy" : "sell") as BarFlowRow["side"],
      },
      ...rows.slice(1),
    ];
  }, [tapeBars, markOnTape, tick]);

  const cumDelta = useMemo(() => cumulativeDelta(barFlow), [barFlow]);
  const tapeLots = useMemo(
    () => tapeLotVolume(instrument, tapeBars, source ?? dataSource),
    [instrument, tapeBars, source, dataSource],
  );
  const last = barFlow.find((r) => r.volume > 0) ?? barFlow[0] ?? null;
  const tapePrints = useMemo(() => {
    const em = spotPrints.map((p, i) => ({
      id: `p-${p.time}-${p.px}-${i}`,
      time: p.time,
      close: p.px,
      volume: p.sz,
      delta: p.side === "buy" ? p.sz : -p.sz,
      side: p.side,
    }));
    const seen = new Set<string>();
    const merged = [...liveTicks, ...em].sort((a, b) => b.time - a.time);
    const out = merged.filter((row) => {
      const key = `${row.time}-${row.close}-${row.side}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (out.length) return out.slice(0, 120);
    return barFlow.slice(0, 40);
  }, [spotPrints, liveTicks, barFlow]);
  const ago = secondsAgo(updatedAt, clock);

  useEffect(() => {
    const px = shownPx ?? markOnTape;
    if (px == null) return;
    const last = snapTick(px, tick);
    const half = Math.max(40, Math.floor(bodyH / DOM_ROW_H / 2));
    setLadder((prev) => {
      if (!prev) {
        return {
          max: Math.round((last + half * tick) * 100) / 100,
          min: Math.round((last - half * tick) * 100) / 100,
        };
      }
      let { min, max } = prev;
      const edge = 4 * tick;
      if (last > max - edge) max = Math.round((last + half * tick) * 100) / 100;
      if (last < min + edge) min = Math.round((last - half * tick) * 100) / 100;
      const span = Math.round((max - min) / tick);
      if (span > DOM_MAX_ROWS) {
        if (last - min > max - last) min = Math.round((max - DOM_MAX_ROWS * tick) * 100) / 100;
        else max = Math.round((min + DOM_MAX_ROWS * tick) * 100) / 100;
      }
      if (min === prev.min && max === prev.max) return prev;
      return { min, max };
    });
  }, [shownPx, markOnTape, tick, bodyH]);

  const levels = useMemo(() => {
    if (markOnTape == null) return [];
    const flow = isMetalDesk(instrument)
      ? aggregateCloseFlow(tapeBars, tick)
      : aggregateFlowByPrice(tapeBars, null, null, tick);
    const rawMax = Math.max(1, ...flow.map((r) => r.buyVol + r.sellVol));
    const scale = rawMax < 40 ? 100 : rawMax < 400 ? 10 : 1;

    const lastTick = snapTick((shownPx ?? bookMark ?? markOnTape) as number, tick);
    const fillRows = Math.max(36, Math.floor(bodyH / DOM_ROW_H));
    let priceMax = ladder?.max ?? lastTick + Math.floor(fillRows / 2) * tick;
    let priceMin = ladder?.min ?? lastTick - (fillRows - Math.floor(fillRows / 2) - 1) * tick;
    let visible = Math.round((priceMax - priceMin) / tick) + 1;
    if (visible > DOM_MAX_ROWS) {
      priceMax = lastTick + Math.floor(DOM_MAX_ROWS / 2) * tick;
      priceMin = lastTick - (DOM_MAX_ROWS - Math.floor(DOM_MAX_ROWS / 2) - 1) * tick;
      visible = DOM_MAX_ROWS;
    }
    if (visible < DOM_MIN_ROWS) {
      const extra = DOM_MIN_ROWS - visible;
      priceMax += Math.ceil(extra / 2) * tick;
      priceMin -= Math.floor(extra / 2) * tick;
      visible = Math.round((priceMax - priceMin) / tick) + 1;
    }
    const prices: number[] = [];
    for (let i = 0; i < visible; i++) {
      prices.push(Math.round((priceMax - i * tick) * 100) / 100);
    }

    const flowAt = new Map(flow.map((r) => [snapTick(r.price, tick), r]));
    const prints = new Map<number, { time: number; close: number; side: "buy" | "sell" }>();
    for (const bar of tapeBars.slice(-360)) {
      const key = snapTick(bar.close, tick);
      const { buyVol, sellVol } = barBuySellVolume(bar);
      const prev = prints.get(key);
      if (!prev || bar.time >= prev.time) {
        prints.set(key, {
          time: bar.time,
          close: bar.close,
          side: buyVol >= sellVol ? "buy" : "sell",
        });
      }
    }
    for (const p of spotPrints) {
      const key = snapTick(p.px, tick);
      const prev = prints.get(key);
      if (!prev || p.time >= prev.time) {
        prints.set(key, { time: p.time, close: p.px, side: p.side });
      }
    }

    const offset = book && bookMark != null ? bookMark - book.mid : 0;
    const bids = new Map<number, number>();
    const asks = new Map<number, number>();
    if (book) {
      for (const lvl of book.bids) {
        const key = snapTick(lvl.px + offset, tick);
        bids.set(key, (bids.get(key) ?? 0) + lvl.usd);
      }
      for (const lvl of book.asks) {
        const key = snapTick(lvl.px + offset, tick);
        asks.set(key, (asks.get(key) ?? 0) + lvl.usd);
      }
    }

    void hitRev;
    const rows = prices.map((price) => {
      const key = snapTick(price, tick);
      const f = flowAt.get(key);
      const buy = Math.round((f?.buyVol ?? 0) * scale);
      const sell = Math.round((f?.sellVol ?? 0) * scale);
      const bookBid = bids.get(key) ?? 0;
      const bookAsk = asks.get(key) ?? 0;
      const hit = hitsRef.current.get(key);
      const buyN = buy + (hit?.buy ?? 0);
      const sellN = sell + (hit?.sell ?? 0);
      const volN = buyN + sellN;
      const print = hit
        ? { time: hit.at, close: hit.last, side: hit.side }
        : (prints.get(key) ?? null);
      return { price, vol: volN, buy: buyN, sell: sellN, bid: bookBid, ask: bookAsk, delta: buyN - sellN, print };
    });

    const maxVol = Math.max(1, ...rows.map((r) => r.vol));
    const maxBid = Math.max(1, ...rows.map((r) => r.bid));
    const maxAsk = Math.max(1, ...rows.map((r) => r.ask));
    const poc = rows.reduce((best, r) => (r.vol > best.vol ? r : best), rows[0]);
    const sessionVol = rows.reduce((s, r) => s + r.vol, 0) || 1;

    return rows.map((r) => ({
      ...r,
      maxVol,
      maxBid,
      maxAsk,
      poc: poc != null && Math.abs(r.price - poc.price) < tick * 0.26,
      hvn: r.vol >= maxVol * 0.72 && r.vol > 0,
      share: Math.round((r.vol / sessionVol) * 100),
      lastRow: Math.abs(r.price - lastTick) < tick * 0.26,
    }));
  }, [tapeBars, markOnTape, bookMark, shownPx, tick, book, hitRev, bodyH, spotPrints, instrument, ladder]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const mark = () => {
      userScrolledRef.current = true;
    };
    body.addEventListener("wheel", mark, { passive: true });
    body.addEventListener("touchmove", mark, { passive: true });
    return () => {
      body.removeEventListener("wheel", mark);
      body.removeEventListener("touchmove", mark);
    };
  }, [levels.length]);

  useEffect(() => {
    if (didCenterRef.current || userScrolledRef.current) return;
    const row = lastRowRef.current;
    const body = bodyRef.current;
    if (!row || !body) return;
    const rowTop = row.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    body.scrollTop = Math.max(0, rowTop - body.clientHeight / 2 + row.clientHeight / 2);
    didCenterRef.current = true;
  }, [levels.length]);

  const hasDesk = livePrice != null || Boolean(book) || tapeBars.length >= 4;
  const [loadWaited, setLoadWaited] = useState(false);
  useEffect(() => {
    if (hasDesk || !loading) {
      setLoadWaited(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadWaited(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [hasDesk, loading]);

  if (loading && !hasDesk && !loadWaited) {
    return (
      <div className={cn("flex h-full items-center justify-center gap-2 text-sm text-muted", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
        {t("goldSignals.loading")}
      </div>
    );
  }

  if (!hasDesk) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center gap-3 px-6 text-center", className)}>
        <p className="text-sm text-muted">{t("goldSignals.orderFlowNoData")}</p>
        {error ? (
          <p className="max-w-md text-[11px] text-rose-300/80">{t("goldSignals.orderFlowError")}</p>
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
    <div className={cn("flex h-full min-h-0 flex-col bg-black text-[11px] text-zinc-300", className)}>
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-white/[0.08] bg-[#07090c] px-2 font-mono tabular-nums">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {t("goldSignals.orderFlowLive")}
        </span>
        {shownPx != null ? (
          <span className="font-semibold text-zinc-100">{formatPx(shownPx, 0.01)}</span>
        ) : null}
        {last ? (
          <span className={last.delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
            Δ {last.delta >= 0 ? "+" : ""}
            {formatVol(last.delta)}
          </span>
        ) : null}
        <span className={cumDelta >= 0 ? "text-emerald-400" : "text-rose-400"}>
          CVD {cumDelta >= 0 ? "+" : ""}
          {formatVol(cumDelta)}
        </span>
        <span className="text-amber-200">
          {t("goldSignals.orderFlowVol")} {formatVol(tapeLots.raw)}
        </span>
        {tapeLots.lots != null ? (
          <span className="text-sky-300">
            {tapeLots.unit === "gc" ? t("goldSignals.gcVolChip") : t("goldSignals.tapeLots")}{" "}
            {formatLots(tapeLots.lots)}
          </span>
        ) : null}
        {book ? (
          <span className="text-blue-300">
            BID {formatDepthUsd(book.depth_10bp_bid_usd)}
          </span>
        ) : null}
        {book ? (
          <span className="text-rose-300">
            ASK {formatDepthUsd(book.depth_10bp_ask_usd)}
          </span>
        ) : l2Error ? (
          <span className="text-zinc-600">{t("goldSignals.orderFlowL2None")}</span>
        ) : null}
        <span className="truncate text-[10px] text-amber-200/80">{t("goldSignals.orderFlowEstimate")}</span>
        {book?.source ? <span className="truncate text-[10px] text-zinc-500">{book.source}</span> : null}
        {ago != null ? <span className="ml-auto text-zinc-600">{ago}s</span> : null}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={cn(
          DOM_COLS,
          "h-6 shrink-0 border-b border-white/[0.08] bg-[#07090c] px-1 font-mono text-[9px] uppercase tracking-wider",
        )}
      >
        <span className="pl-1 text-sky-400">Profile</span>
        <span className="text-right text-amber-300">Volume</span>
        <span className="text-right text-zinc-300">Price</span>
        <span className="text-center text-blue-400">Bid</span>
        <span className="text-center text-rose-400">Sell</span>
        <span className="text-center text-emerald-400">Buy</span>
        <span className="text-center text-red-400">Ask</span>
        <span className="text-right text-yellow-300">Δ</span>
        <span className="text-right text-cyan-400">%</span>
        <span className="pr-1 text-right text-zinc-400">Time</span>
        <span className="pr-1 text-right text-zinc-400">Price</span>
        <span className="pr-1 text-right text-sky-300">{t("goldSignals.orderFlowL2")}</span>
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto font-mono tabular-nums">
        {levels.map((row, i) => {
          const barW = Math.max(row.vol > 0 ? 8 : 0, (row.vol / row.maxVol) * 100);
          const sellShare = row.vol > 0 ? row.sell / row.vol : 0.5;
          const sellW = barW * sellShare;
          const buyW = barW - sellW;
          const heat = row.vol / row.maxVol;
          const bidFill = row.bid > 0 ? 0.42 + (row.bid / row.maxBid) * 0.58 : 0;
          const askFill = row.ask > 0 ? 0.42 + (row.ask / row.maxAsk) * 0.58 : 0;
          const printAt = row.print
            ? new Date(row.print.time > 1e12 ? row.print.time : row.print.time * 1000)
            : null;
          const showAt = row.lastRow ? new Date() : printAt;
          const hitSide = row.lastRow ? row.print?.side : null;
          const mark = bookMark ?? markOnTape;
          const above = mark != null && row.price > mark + tick * 0.01;
          const l2Usd = row.lastRow ? Math.max(row.bid, row.ask) : above ? row.ask : row.bid;
          const l2Side = row.lastRow ? (row.ask >= row.bid ? "ask" : "bid") : above ? "ask" : "bid";
          const l2W = l2Usd > 0 ? Math.max(8, (l2Usd / Math.max(1, row.maxBid, row.maxAsk)) * 100) : 0;
          return (
            <div
              key={`${row.price}-${i}`}
              ref={row.lastRow ? lastRowRef : undefined}
              className={cn(
                DOM_COLS,
                "h-4 px-0.5",
                row.lastRow && "bg-amber-400/15",
                !row.lastRow && above && "bg-rose-500/[0.06]",
                !row.lastRow && !above && "bg-blue-500/[0.05]",
                row.lastRow && flashKey > 0 && "gold-dom-hit-last",
              )}
            >
              <div className="relative h-full overflow-hidden bg-[#0c1016] pr-1">
                <div
                  className="absolute inset-y-[1px] left-0"
                  style={{
                    width: `${sellW}%`,
                    background: `linear-gradient(90deg, #7f1d1d, #ef4444 ${Math.round(40 + heat * 60)}%)`,
                  }}
                />
                <div
                  className="absolute inset-y-[1px]"
                  style={{
                    left: `${sellW}%`,
                    width: `${buyW}%`,
                    background: `linear-gradient(90deg, #16a34a, #4ade80)`,
                  }}
                />
              </div>
              <span
                className={cn(
                  "mx-0.5 text-right",
                  row.poc
                    ? "bg-[#f5d76e] px-0.5 font-bold text-black"
                    : row.hvn
                      ? "bg-[#fb923c] px-0.5 font-semibold text-black"
                      : heat > 0.45
                        ? "text-cyan-300"
                        : "text-zinc-400",
                )}
              >
                {formatDomVol(row.vol)}
              </span>
              <span
                className={cn(
                  "pr-1 text-right",
                  row.lastRow ? "bg-[#f5d76e] font-bold text-black" : "text-zinc-100",
                )}
              >
                {row.lastRow && shownPx != null ? formatPx(shownPx, 0.01) : formatPx(row.price, tick)}
              </span>
              <span
                className="text-center font-semibold text-white"
                style={{
                  background:
                    row.bid > 0 ? `rgba(59, 130, 246, ${bidFill})` : "transparent",
                  boxShadow: row.poc && row.bid > 0 ? "inset 0 0 0 1px #f5d76e" : undefined,
                }}
              >
                {row.bid > 0 ? formatDepthUsd(row.bid) : ""}
              </span>
              <span
                key={`s-${row.price}-${row.sell}`}
                className={cn(
                  "text-center font-semibold text-[#fb7185]",
                  row.sell > 0 && "bg-rose-500/15",
                  row.lastRow && hitSide === "sell" && "gold-dom-hit-sell",
                )}
              >
                {row.sell > 0 ? row.sell : ""}
              </span>
              <span
                key={`b-${row.price}-${row.buy}`}
                className={cn(
                  "text-center font-semibold text-[#4ade80]",
                  row.buy > 0 && "bg-emerald-500/15",
                  row.lastRow && hitSide === "buy" && "gold-dom-hit-buy",
                )}
              >
                {row.buy > 0 ? row.buy : ""}
              </span>
              <span
                className="text-center font-semibold text-white"
                style={{
                  background:
                    row.ask > 0 ? `rgba(239, 68, 68, ${askFill})` : "transparent",
                  boxShadow: row.hvn && row.ask > 0 ? "inset 0 0 0 1px #f5d76e" : undefined,
                }}
              >
                {row.ask > 0 ? formatDepthUsd(row.ask) : ""}
              </span>
              <span
                className={cn(
                  "pr-1 text-right font-semibold",
                  row.delta > 0 ? "text-[#4ade80]" : row.delta < 0 ? "text-[#fb7185]" : "text-zinc-600",
                )}
              >
                {row.delta !== 0 ? String(row.delta) : ""}
              </span>
              <span
                className={cn(
                  "pr-1 text-right",
                  row.share >= 8 ? "text-cyan-300" : "text-zinc-500",
                )}
              >
                {row.share > 0 ? row.share : ""}
              </span>
              <span className="pr-1 text-right text-zinc-500">
                {showAt
                  ? showAt.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : ""}
              </span>
              <span
                className={cn(
                  "pr-1 text-right",
                  (row.lastRow ? (hitSide ?? row.print?.side) : row.print?.side) === "sell"
                    ? "text-rose-400"
                    : "text-emerald-400",
                )}
              >
                {row.lastRow && markOnTape != null
                  ? formatPx(markOnTape, tick)
                  : row.print
                    ? formatPx(row.print.close, tick)
                    : ""}
              </span>
              <div className="relative h-full overflow-hidden border-l border-white/[0.06] bg-[#07090c]">
                {l2Usd > 0 ? (
                  <div
                    className={cn(
                      "absolute inset-y-[1px]",
                      l2Side === "ask" ? "right-0 bg-rose-500/45" : "left-0 bg-blue-500/45",
                    )}
                    style={{ width: `${l2W}%` }}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-[1] block pr-1 text-right tabular-nums",
                    l2Side === "ask" ? "text-rose-200" : "text-sky-200",
                    row.lastRow && "font-semibold text-amber-200",
                  )}
                >
                  {l2Usd > 0 ? formatDepthUsd(l2Usd) : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
        </div>
        <div className="flex w-[228px] shrink-0 flex-col border-l border-white/[0.08] bg-[#07090c]">
          <div className="grid h-6 shrink-0 grid-cols-[68px_62px_40px_40px] items-center border-b border-white/[0.08] px-1.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            <span>{t("goldSignals.orderFlowTime")}</span>
            <span className="text-right">{t("goldSignals.orderFlowTimeSales")}</span>
            <span className="text-right">{t("goldSignals.orderFlowSize")}</span>
            <span className="text-right">{t("goldSignals.orderFlowDelta")}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto font-mono tabular-nums">
            {tapePrints.length === 0 ? (
              <p className="px-2 py-6 text-center text-[10px] text-zinc-600">{t("goldSignals.orderFlowNoData")}</p>
            ) : (
              tapePrints.slice(0, 120).map((row, i) => {
                const at = new Date(row.time > 1e12 ? row.time : row.time * 1000);
                const hh = String(at.getHours()).padStart(2, "0");
                const mm = String(at.getMinutes()).padStart(2, "0");
                const ss = String(at.getSeconds()).padStart(2, "0");
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "grid h-[17px] grid-cols-[68px_62px_40px_40px] items-center px-1.5 text-[11px]",
                      row.side === "sell" ? "text-rose-400" : "text-emerald-400",
                      i === 0 && "bg-amber-400/12 font-semibold",
                    )}
                  >
                    <span className={cn("text-zinc-400", i === 0 && "text-amber-200")}>
                      {hh}:{mm}:{ss}
                    </span>
                    <span className="text-right font-semibold">{formatPx(row.close, tick)}</span>
                    <span className="text-right text-zinc-200">{row.volume}</span>
                    <span
                      className={cn(
                        "text-right",
                        row.delta >= 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {row.delta >= 0 ? "+" : ""}
                      {row.delta}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
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
  const { structureBars, livePrice } = useGoldDesk();
  const [hideEmpty, setHideEmpty] = useHideEmptyPrices();
  const scrollRef = useRef<HTMLDivElement>(null);
  const centredRef = useRef(false);
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

  // Row nearest the live price (falls back to the most recent bar close).
  const refPrice = livePrice ?? structureBars.at(-1)?.close ?? null;
  const currentRowPrice = useMemo(() => {
    if (refPrice == null) return null;
    let best: number | null = null;
    for (const item of items) {
      if (item.kind !== "row") continue;
      if (best == null || Math.abs(item.row.price - refPrice) < Math.abs(best - refPrice)) best = item.row.price;
    }
    return best;
  }, [items, refPrice]);

  /** Scroll only the ladder container (never the page) so the current price sits in the middle. */
  const centreOnPrice = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const box = scrollRef.current;
      if (!box || currentRowPrice == null) return false;
      const row = box.querySelector<HTMLElement>(`[data-price="${currentRowPrice}"]`);
      if (!row) return false;
      const top = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2;
      box.scrollTo({ top: Math.max(0, top), behavior });
      return true;
    },
    [currentRowPrice],
  );

  // Auto-centre once, on first load with data.
  useEffect(() => {
    if (centredRef.current) return;
    if (centreOnPrice("auto")) centredRef.current = true;
  }, [centreOnPrice]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-card-border px-2 py-1">
        <button
          type="button"
          onClick={() => centreOnPrice()}
          disabled={currentRowPrice == null}
          data-testid="ladder-jump-to-price"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-card-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-40"
        >
          <Crosshair className="h-3 w-3" />
          {t("goldSignals.jumpToPrice")}
        </button>
        <label className="inline-flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-muted hover:text-foreground">
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
      <div
        ref={scrollRef}
        data-testid="orderflow-ladder-scroll"
        className="relative min-h-0 flex-1 overflow-y-auto font-mono text-[10px]"
      >
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
                  data-price={row.price}
                  className={cn(
                    "border-b border-l-2 border-b-white/[0.03] border-l-transparent px-2 py-1 text-muted/60",
                    row.inEntryZone && "bg-amber-500/10",
                    row.price === currentRowPrice && "border-l-accent bg-accent/10 text-foreground",
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
                data-price={row.price}
                className={cn(
                  "border-b border-l-2 border-b-white/[0.03] border-l-transparent px-2 py-1.5 transition-colors duration-300",
                  row.inEntryZone && "bg-amber-500/10",
                  row.price === currentRowPrice && "border-l-accent bg-accent/10",
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
