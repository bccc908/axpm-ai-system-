"use client";

import { useCallback, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { useGoldDesk } from "@/components/gold/gold-desk-context";
import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";
import { heatAlpha, heatRgb, mapCellHeatIntensity, VIZ } from "@/lib/gold-signals/viz-colors";
import { cn } from "@/lib/utils";
import type { DeskSignal } from "@/lib/market-signals/instruments";

const BG = VIZ.bg;

const MODE_LABEL: Record<string, string> = {
  heatmap: "LIQUIDITY HEATMAP",
  footprint: "FOOTPRINT",
  absorption: "ABSORPTION",
  imbalance: "IMBALANCE",
  delta: "DELTA PROFILE",
};

type DisplayBar = {
  x: number;
  time: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  buy: boolean;
};

function seeded(seed: string, i: number) {
  let h = 0;
  const s = `${seed}-${i}`;
  for (let j = 0; j < s.length; j++) h = (h << 5) - h + s.charCodeAt(j);
  return (Math.abs(h) % 1000) / 1000;
}

function gauss(dist: number, sigma: number) {
  return Math.exp(-(dist * dist) / (2 * sigma * sigma));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function formatVol(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

type LiveTick = {
  price: number;
  buy: boolean;
  at: number;
};

function formatTimeSec(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatTime(ts: number, withSec = false) {
  return new Date(ts * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSec ? { second: "2-digit" as const } : {}),
    hour12: false,
  });
}

function mergeSecondTicks(
  base: DisplayBar[],
  ticks: LiveTick[],
  chartW: number,
  reserveRatio = 0.18,
): DisplayBar[] {
  if (base.length < 4 || ticks.length === 0) return base;
  const reserve = Math.max(8, Math.floor(base.length * reserveRatio));
  const hist = base.slice(0, base.length - reserve);
  const slice = ticks.slice(-reserve);
  const bandW = (chartW * reserveRatio) / Math.max(1, slice.length);
  const startX = chartW - bandW * slice.length;
  const now = Math.floor(Date.now() / 1000);
  const tickBars: DisplayBar[] = slice.map((t, i) => ({
    x: startX + i * bandW,
    time: t.at || now - (slice.length - i),
    close: t.price,
    high: t.price,
    low: t.price,
    volume: 350 + (i === slice.length - 1 ? 900 : 180),
    buy: t.buy,
  }));
  return [...hist, ...tickBars];
}

function buildSimBars(
  spot: number,
  cols: number,
  seed: string,
  bias: DeskSignal["bias"],
  chartW: number,
): DisplayBar[] {
  const bars: DisplayBar[] = [];
  let p = spot;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < cols; i++) {
    const noise = (seeded(seed, i) - 0.5) * 4;
    const drift = bias === "short" ? -0.3 : bias === "long" ? 0.24 : 0;
    p = p + noise + drift + (spot - p) * 0.03;
    const vol = 800 + seeded(seed, i + 100) * 4200;
    const buy = seeded(seed, i + 200) > (bias === "short" ? 0.42 : 0.5);
    bars.push({
      x: (i / (cols - 1)) * chartW,
      time: now - (cols - i) * 300,
      close: p,
      high: p + seeded(seed, i + 300) * 3,
      low: p - seeded(seed, i + 400) * 3,
      volume: vol,
      buy,
    });
  }
  return bars;
}

function ohlcToDisplay(bars: GoldOhlcBar[], cols: number, chartW: number): DisplayBar[] {
  const slice = bars.slice(-cols);
  if (slice.length < 4) return [];
  const out: DisplayBar[] = [];
  for (let i = 0; i < cols; i++) {
    const t = (i / (cols - 1)) * (slice.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, slice.length - 1);
    const frac = t - lo;
    const b0 = slice[lo];
    const b1 = slice[hi];
    const close = b0.close * (1 - frac) + b1.close * frac;
    const high = Math.max(b0.high, b1.high);
    const low = Math.min(b0.low, b1.low);
    const volume = b0.volume * (1 - frac) + b1.volume * frac;
    const buy = b0.close >= b0.open;
    const time = b0.time * (1 - frac) + b1.time * frac;
    out.push({ x: (i / (cols - 1)) * chartW, time, close, high, low, volume, buy });
  }
  return out;
}

function priceBounds(
  ohlc: GoldOhlcBar[],
  spot: number,
  stop: number,
  entryLo: number,
  entryHi: number,
  targets: number[],
) {
  const sigMin = Math.min(...targets, entryLo, spot);
  const sigMax = Math.max(stop, entryHi, spot);
  if (ohlc.length >= 4) {
    const dataMin = Math.min(...ohlc.map((b) => b.low));
    const dataMax = Math.max(...ohlc.map((b) => b.high));
    const pad = Math.max(6, (dataMax - dataMin) * 0.08);
    return {
      min: Math.min(dataMin, sigMin) - pad,
      max: Math.max(dataMax, sigMax) + pad,
    };
  }
  return { min: sigMin - 14, max: sigMax + 14 };
}

export function GoldHeatmapViz({
  signal,
  mode = "heatmap",
  className,
}: {
  signal: DeskSignal | null;
  mode?: string;
  className?: string;
}) {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const pulseRef = useRef(0);
  const tickTrailRef = useRef<LiveTick[]>([]);
  const { bars, loading, livePrice, clock, flashKey, updatedAt } = useGoldDesk();

  useEffect(() => {
    if (livePrice == null) return;
    const prev = tickTrailRef.current.at(-1)?.price ?? livePrice;
    tickTrailRef.current = [
      ...tickTrailRef.current.slice(-119),
      { price: livePrice, buy: livePrice >= prev, at: Math.floor(Date.now() / 1000) },
    ];
  }, [clock, livePrice]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(520, rect.width);
    const h = Math.max(360, rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pulse = pulseRef.current;
    const spot = livePrice ?? signal?.spot_price ?? 2650;
    const entryLo = signal?.entry_zone?.low ?? spot - 8;
    const entryHi = signal?.entry_zone?.high ?? spot + 4;
    const stop = signal?.stop_loss ?? spot + 15;
    const targets = signal?.take_profit?.length ? signal.take_profit : [spot - 12, spot - 24];
    const bias = signal?.bias ?? "neutral";
    const seed = signal?.id ?? "x";

    const labelPad = 52;
    const cobW = 32;
    const svpW = 38;
    const axisW = 52;
    const rightW = cobW + svpW + axisW + 6;
    const left = labelPad + 2;
    const top = 24;
    const timeAxisH = 16;
    const deltaH = Math.max(64, h * 0.22);
    const volBarH = 18;
    const mainH = h - top - deltaH - volBarH - timeAxisH - 12;
    const chartW = w - left - rightW - 6;
    const deltaTop = top + mainH + volBarH + timeAxisH + 6;

    const { min: priceMin, max: priceMax } = priceBounds(bars, spot, stop, entryLo, entryHi, targets);
    const priceToY = (p: number) => top + mainH - ((p - priceMin) / (priceMax - priceMin)) * mainH;
    const yToPrice = (y: number) => priceMax - ((y - top) / mainH) * (priceMax - priceMin);

    const cols = Math.max(80, Math.floor(chartW / 5));
    const rows = 56;
    const cellW = chartW / cols;
    const cellH = mainH / rows;

    const fromOhlc = ohlcToDisplay(bars, cols, chartW);
    const baseBars = fromOhlc.length >= 4 ? fromOhlc : buildSimBars(spot, cols, seed, bias, chartW);
    const displayBars = mergeSecondTicks(baseBars, tickTrailRef.current, chartW);

    const currentPrice = livePrice ?? displayBars[displayBars.length - 1]?.close ?? spot;

    // ── background + vignette ──
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    const walls: Array<{ price: number; strength: number; tag?: string }> = [
      { price: stop, strength: 0.98, tag: "SL" },
      { price: entryHi, strength: 0.85 },
      { price: entryLo, strength: 0.8 },
      ...targets.map((p, i) => ({ price: p, strength: 0.72 - i * 0.08, tag: `TP${i + 1}` })),
    ];
    for (let i = 0; i < 10; i++) {
      const p = Math.round((priceMin + seeded(seed, i + 500) * (priceMax - priceMin)) * 2) / 2;
      walls.push({
        price: p,
        strength: 0.35 + seeded(seed, i + 600) * 0.55,
        tag: seeded(seed, i + 650) > 0.55 ? "HVN" : undefined,
      });
    }

    // ── entry zone band ──
    const ezTop = priceToY(entryHi);
    const ezBot = priceToY(entryLo);
    ctx.fillStyle = "rgba(0, 255, 136, 0.055)";
    ctx.fillRect(left, ezTop, chartW, ezBot - ezTop);
    ctx.strokeStyle = "rgba(0, 255, 136, 0.12)";
    ctx.setLineDash([2, 4]);
    ctx.strokeRect(left, ezTop, chartW, ezBot - ezTop);
    ctx.setLineDash([]);

    // ── liquidity wall glow (horizontal bands) ──
    for (const wall of walls) {
      if (wall.strength < 0.38) continue;
      const wy = priceToY(wall.price);
      const bandH = 10 + wall.strength * 26;
      const g = ctx.createLinearGradient(0, wy - bandH, 0, wy + bandH);
      const hot = wall.strength > 0.52;
      const warm = wall.strength > 0.38;
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(
        0.5,
        hot
          ? `rgba(255, 40, 30, ${0.18 + wall.strength * 0.35})`
          : warm
            ? `rgba(255, 90, 35, ${0.12 + wall.strength * 0.22})`
            : `rgba(200, 50, 45, ${0.08 + wall.strength * 0.14})`,
      );
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(left, wy - bandH, chartW, bandH * 2);
    }

    const bearish = bias === "short";

    // ── heatmap cells ──
    for (let r = 0; r < rows; r++) {
      const price = priceMax - (r / rows) * (priceMax - priceMin);
      let rowBase = 0.04;
      for (const wall of walls) rowBase += wall.strength * gauss(price - wall.price, 2.4) * 0.82;
      rowBase = Math.min(1, rowBase);

      for (let c = 0; c < cols; c++) {
        const colFade = 0.62 + 0.38 * (c / cols);
        const micro = seeded(seed, c * 17 + r * 11) * 0.14;
        let intensity = rowBase * colFade + micro;
        if (c >= cols - 4) intensity += pulse * 0.18;
        // Below spot / bearish tape → warmer (more red-orange liquidity)
        if (price < currentPrice) {
          intensity += 0.1 + (1 - Math.abs(price - currentPrice) / (priceMax - priceMin)) * 0.08;
        }
        if (bearish && price < currentPrice + (priceMax - priceMin) * 0.15) {
          intensity += 0.06;
        }
        intensity = mapCellHeatIntensity(intensity);
        intensity = Math.min(1, intensity);

        if (mode === "delta") {
          const buy = seeded(seed, c + r) > 0.48;
          ctx.fillStyle = buy
            ? `rgba(0, 210, 255, ${0.25 + intensity * 0.6})`
            : `rgba(255, 45, 70, ${0.25 + intensity * 0.6})`;
        } else if (mode === "imbalance") {
          const skew = seeded(seed, c * 3 + r) - 0.5;
          ctx.fillStyle =
            skew > 0
              ? `rgba(0, 255, 136, ${0.15 + Math.abs(skew) * 0.7})`
              : `rgba(255, 51, 85, ${0.15 + Math.abs(skew) * 0.7})`;
        } else {
          const [cr, cg, cb] = heatRgb(intensity);
          const redBoost = price < currentPrice ? 1.08 : 1.04;
          ctx.fillStyle = `rgba(${Math.min(255, Math.round(cr * redBoost))},${Math.max(0, Math.round(cg * 0.88))},${Math.max(0, Math.round(cb * 0.75))},${heatAlpha(intensity)})`;
        }
        ctx.fillRect(left + c * cellW, top + r * cellH, cellW + 0.6, cellH + 0.6);
      }
    }

    // ── SVP from bars ──
    const svpBuy = new Float64Array(rows);
    const svpSell = new Float64Array(rows);
    for (const bar of displayBars) {
      const ri = Math.max(
        0,
        Math.min(rows - 1, Math.floor(((priceMax - bar.close) / (priceMax - priceMin)) * rows)),
      );
      const spread = Math.max(1, Math.floor(((bar.high - bar.low) / (priceMax - priceMin)) * rows * 0.5));
      for (let dr = -spread; dr <= spread; dr++) {
        const rr = ri + dr;
        if (rr < 0 || rr >= rows) continue;
        const wgt = gauss(dr, spread * 0.6 + 0.5);
        if (bar.buy) svpBuy[rr] += bar.volume * wgt;
        else svpSell[rr] += bar.volume * wgt;
      }
    }
    let pocRow = 0;
    for (let r = 1; r < rows; r++) {
      if (svpBuy[r] + svpSell[r] > svpBuy[pocRow] + svpSell[pocRow]) pocRow = r;
    }
    const maxSvp = Math.max(1, ...svpBuy, ...svpSell);

    const cobX = left + chartW + 4;
    const svpX = cobX + cobW + 4;
    const axisX = svpX + svpW + 4;

    // panel separators
    ctx.fillStyle = "rgba(12, 18, 28, 0.95)";
    ctx.fillRect(cobX - 2, top - 2, rightW + 4, mainH + volBarH + timeAxisH + 6);
    ctx.strokeStyle = "rgba(60, 80, 110, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cobX - 2, top);
    ctx.lineTo(cobX - 2, top + mainH + volBarH + timeAxisH);
    ctx.stroke();

    for (let r = 0; r < rows; r++) {
      const price = priceMax - (r / rows) * (priceMax - priceMin);
      const y = top + r * cellH;

      let cob = 0;
      for (const wall of walls) cob += wall.strength * gauss(price - wall.price, 3.2) * 130;
      cob += seeded(seed, r + 700) * 35;
      const cobNorm = Math.min(1, cob / 110);
      const cobBarW = cobNorm * (cobW - 4);
      ctx.fillStyle = `rgba(0, 195, 255, ${0.3 + cobNorm * 0.65})`;
      roundRect(ctx, cobX + cobW - cobBarW - 1, y + 0.5, cobBarW, cellH - 1, 1);
      ctx.fill();

      const buyW = (svpBuy[r] / maxSvp) * (svpW * 0.46);
      const sellW = (svpSell[r] / maxSvp) * (svpW * 0.46);
      ctx.fillStyle = "rgba(0, 255, 136, 0.88)";
      roundRect(ctx, svpX + 1, y + 0.5, buyW, cellH - 1, 1);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 51, 85, 0.88)";
      roundRect(ctx, svpX + svpW - sellW - 1, y + 0.5, sellW, cellH - 1, 1);
      ctx.fill();

      if (r === pocRow) {
        ctx.strokeStyle = VIZ.gold;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(svpX, y + cellH / 2);
        ctx.lineTo(svpX + svpW, y + cellH / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.fillStyle = "rgba(140, 175, 210, 0.65)";
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.fillText("COB", cobX + 2, top - 6);
    ctx.fillText("SVP", svpX + 2, top - 6);
    ctx.fillStyle = VIZ.gold;
    ctx.font = "6px ui-monospace, monospace";
    ctx.fillText("POC", svpX + svpW - 18, top - 6);

    // grid — major + minor
    ctx.strokeStyle = "rgba(55, 72, 95, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      const y = top + (i * mainH) / 16;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + chartW, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(55, 72, 95, 0.08)";
    for (let i = 0; i <= cols; i += 4) {
      const x = left + i * cellW;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + mainH);
      ctx.stroke();
    }

    // signal levels
    const levels: Array<{ p: number; label: string; color: string; dash?: number[] }> = [
      { p: stop, label: "STOP", color: VIZ.sell, dash: [5, 3] },
      { p: entryHi, label: "ENTRY", color: VIZ.buy, dash: [4, 4] },
      { p: entryLo, label: "ENTRY", color: VIZ.buy, dash: [4, 4] },
      ...targets.map((p, i) => ({ p, label: `TP${i + 1}`, color: VIZ.gold, dash: [6, 3] as number[] })),
    ];
    for (const lv of levels) {
      const y = priceToY(lv.p);
      ctx.strokeStyle = lv.color;
      ctx.lineWidth = lv.label.startsWith("TP") ? 1 : 1.25;
      ctx.setLineDash(lv.dash ?? [4, 3]);
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(axisX + axisW - 2, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.fillStyle = lv.color;
      ctx.font = "bold 7px ui-monospace, monospace";
      ctx.fillText(lv.label, 4, y - 3);
      ctx.fillStyle = "rgba(200, 210, 220, 0.75)";
      ctx.font = "7px ui-monospace, monospace";
      ctx.fillText(lv.p.toFixed(1), 4, y + 8);
    }

    // current price line
    const cpY = priceToY(currentPrice);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, cpY);
    ctx.lineTo(axisX + axisW - 2, cpY);
    ctx.stroke();
    ctx.setLineDash([]);

    // price axis
    ctx.font = "8px ui-monospace, monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 8; i++) {
      const p = priceMax - (i / 8) * (priceMax - priceMin);
      const y = priceToY(p);
      ctx.fillStyle = "rgba(150, 168, 190, 0.55)";
      ctx.fillRect(axisX, y, axisW, 1);
      ctx.fillStyle = "rgba(175, 190, 210, 0.75)";
      ctx.fillText(p.toFixed(1), axisX + axisW - 4, y + 3);
    }

    const lastBuy =
      tickTrailRef.current.at(-1)?.buy ?? displayBars[displayBars.length - 1]?.buy ?? true;
    const boxColor = lastBuy ? VIZ.buy : VIZ.sell;
    const flashBoost = flashKey > 0 ? 0.35 : 0;
    ctx.shadowColor = boxColor;
    ctx.shadowBlur = 10 + pulse * 10 + flashBoost * 12;
    ctx.fillStyle = boxColor;
    roundRect(ctx, axisX + 2, cpY - 9, axisW - 6, 16, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#11161e";
    ctx.font = "bold 8px ui-monospace, monospace";
    ctx.fillText(currentPrice.toFixed(2), axisX + axisW - 4, cpY + 3);
    ctx.textAlign = "left";

    // tape line — ends at live price
    ctx.strokeStyle = bearish ? "rgba(255, 70, 90, 0.55)" : "rgba(0, 229, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < displayBars.length; i++) {
      const x = left + displayBars[i].x;
      const y = priceToY(i === displayBars.length - 1 ? currentPrice : displayBars[i].close);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // volume bubbles
    const maxVol = Math.max(1, ...displayBars.map((b) => b.volume));
    for (let i = 0; i < displayBars.length; i++) {
      const bar = displayBars[i];
      const x = left + bar.x;
      const isLast = i === displayBars.length - 1;
      const y = priceToY(isLast ? currentPrice : bar.close);
      const norm = bar.volume / maxVol;
      const isLive = i >= displayBars.length - tickTrailRef.current.length;
      const radius = 2.5 + norm * 16 + (isLast ? pulse * 5 : isLive ? pulse * 2 : 0);
      const color = bar.buy ? "rgba(0, 255, 136, 0.9)" : "rgba(255, 51, 85, 0.9)";
      const stroke = bar.buy ? "#26a69a" : "#ef5350";

      const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
      grad.addColorStop(0, bar.buy ? "rgba(180,255,220,0.95)" : "rgba(255,180,190,0.95)");
      grad.addColorStop(0.45, color);
      grad.addColorStop(1, bar.buy ? "rgba(0,120,70,0.85)" : "rgba(140,20,40,0.85)");

      ctx.save();
      ctx.shadowColor = bar.buy ? "rgba(38,166,154,0.8)" : "rgba(239,83,80,0.8)";
      ctx.shadowBlur = 10 + norm * 12 + (isLive ? pulse * 14 : 0);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      if (norm > 0.22 && (mode === "heatmap" || mode === "footprint")) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = "bold 6px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(formatVol(bar.volume), x, y - radius - 3);
        ctx.textAlign = "left";
      }

      if (mode === "footprint" && norm > 0.35 && cellW > 4) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.font = "6px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(bar.buy ? "B" : "S", x, y + 2);
        ctx.textAlign = "left";
      }
    }

    // HVN tags on strong walls
    ctx.font = "6px ui-monospace, monospace";
    for (const wall of walls) {
      if (!wall.tag || wall.strength < 0.55) continue;
      const y = priceToY(wall.price);
      ctx.fillStyle = "rgba(255, 180, 60, 0.85)";
      ctx.fillText(wall.tag, left + chartW - 28, y - 2);
    }

    // volume histogram under main
    const volTop = top + mainH + 3;
    for (let i = 0; i < displayBars.length; i++) {
      const bar = displayBars[i];
      const x = left + bar.x - cellW * 0.42;
      const bh = (bar.volume / maxVol) * volBarH;
      ctx.fillStyle = bar.buy ? "rgba(38,166,154,0.7)" : "rgba(239,83,80,0.7)";
      roundRect(ctx, x, volTop + volBarH - bh, cellW * 0.84, bh, 1);
      ctx.fill();
    }

    // time axis
    ctx.fillStyle = "rgba(130, 150, 175, 0.45)";
    ctx.font = "7px ui-monospace, monospace";
    const timeStep = Math.max(1, Math.floor(displayBars.length / 8));
    for (let i = 0; i < displayBars.length; i += timeStep) {
      const bar = displayBars[i];
      const x = left + bar.x;
      const isLiveZone = i >= displayBars.length - Math.min(12, tickTrailRef.current.length);
      ctx.fillText(formatTime(bar.time, isLiveZone), x - 16, volTop + volBarH + 12);
      ctx.strokeStyle = "rgba(80,100,120,0.15)";
      ctx.beginPath();
      ctx.moveTo(x, top + mainH);
      ctx.lineTo(x, volTop + volBarH);
      ctx.stroke();
    }
    if (displayBars.length > 0) {
      const last = displayBars[displayBars.length - 1];
      const lx = left + last.x;
      ctx.fillStyle = VIZ.cyanBright;
      ctx.fillText(formatTimeSec(last.time), lx - 22, volTop + volBarH + 12);
    }

    // ── cumulative delta panel ──
    ctx.fillStyle = "#080c12";
    ctx.fillRect(left, deltaTop, chartW + rightW - axisW + 8, deltaH);
    ctx.strokeStyle = "rgba(60, 80, 110, 0.4)";
    ctx.strokeRect(left, deltaTop, chartW + rightW - axisW + 8, deltaH);

    ctx.fillStyle = "rgba(140,175,210,0.55)";
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.fillText("CUMULATIVE DELTA", left + 6, deltaTop + 12);

    let cumNet = 0;
    const deltaPoints: Array<{ x: number; net: number; delta: number }> = [];
    for (let i = 0; i < displayBars.length; i++) {
      const bar = displayBars[i];
      const delta = bar.buy ? bar.volume : -bar.volume;
      cumNet += delta;
      deltaPoints.push({ x: left + bar.x, net: cumNet, delta });
    }

    const maxNet = Math.max(1, ...deltaPoints.map((p) => Math.abs(p.net)));
    const maxBar = Math.max(1, ...deltaPoints.map((p) => Math.abs(p.delta)));
    const midY = deltaTop + deltaH * 0.58;
    const barAreaTop = deltaTop + 18;
    const barAreaH = deltaH - 28;

    // per-bar delta histogram
    for (const pt of deltaPoints) {
      const bh = (Math.abs(pt.delta) / maxBar) * (barAreaH * 0.35);
      ctx.fillStyle = pt.delta >= 0 ? "rgba(38,166,154,0.35)" : "rgba(239,83,80,0.35)";
      const bx = pt.x - cellW * 0.35;
      if (pt.delta >= 0) ctx.fillRect(bx, midY - bh, cellW * 0.7, bh);
      else ctx.fillRect(bx, midY, cellW * 0.7, bh);
    }

    // filled area under net line
    ctx.beginPath();
    for (let i = 0; i < deltaPoints.length; i++) {
      const y = midY - (deltaPoints[i].net / maxNet) * (barAreaH * 0.42);
      if (i === 0) ctx.moveTo(deltaPoints[i].x, y);
      else ctx.lineTo(deltaPoints[i].x, y);
    }
    ctx.lineTo(deltaPoints[deltaPoints.length - 1]?.x ?? left, midY);
    ctx.lineTo(deltaPoints[0]?.x ?? left, midY);
    ctx.closePath();
    ctx.fillStyle = cumNet >= 0 ? "rgba(38,166,154,0.08)" : "rgba(239,83,80,0.08)";
    ctx.fill();

    ctx.strokeStyle = cumNet >= 0 ? VIZ.buy : VIZ.sell;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < deltaPoints.length; i++) {
      const y = midY - (deltaPoints[i].net / maxNet) * (barAreaH * 0.42);
      if (i === 0) ctx.moveTo(deltaPoints[i].x, y);
      else ctx.lineTo(deltaPoints[i].x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(80,100,120,0.2)";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(left, midY);
    ctx.lineTo(left + chartW, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(160,180,200,0.6)";
    ctx.font = "7px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(formatVol(Math.abs(cumNet)), left + chartW - 4, deltaTop + 12);
    ctx.textAlign = "left";

    // liquidation gauges
    const gaugeR = 20;
    const gY = deltaTop + deltaH - gaugeR - 8;
    const buyLiq = 0.35 + seeded(seed, 900) * 0.5;
    const sellLiq = 0.4 + seeded(seed, 901) * 0.45;

    const drawGauge = (cx: number, value: number, color: string, label: string) => {
      ctx.strokeStyle = "rgba(60,80,110,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, gY, gaugeR, Math.PI, 0);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(cx, gY, gaugeR, Math.PI, Math.PI + value * Math.PI);
      ctx.stroke();
      ctx.fillStyle = "rgba(140,175,210,0.55)";
      ctx.font = "6px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, cx, gY + 13);
      ctx.textAlign = "left";
    };

    drawGauge(left + chartW - 58, buyLiq, VIZ.buy, "Buy Liq");
    drawGauge(left + chartW - 18, sellLiq, VIZ.sell, "Sell Liq");

    // header + legend
    ctx.fillStyle = VIZ.cyan;
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.fillText(MODE_LABEL[mode] ?? "LIQUIDITY", left, 14);

    const legendX = left + chartW - 108;
    ctx.fillStyle = "rgba(140,175,210,0.55)";
    ctx.font = "7px ui-monospace, monospace";
    ctx.fillText("COLD 30%", legendX, 13);
    roundRect(ctx, legendX + 28, 7, 58, 8, 2);
    ctx.strokeStyle = "rgba(80,100,120,0.4)";
    ctx.stroke();
    const grad = ctx.createLinearGradient(legendX + 29, 8, legendX + 85, 8);
    grad.addColorStop(0, "#0a1530");
    grad.addColorStop(0.12, "#4a1838");
    grad.addColorStop(0.28, "#aa4422");
    grad.addColorStop(0.48, "#ff6622");
    grad.addColorStop(0.68, "#ff3311");
    grad.addColorStop(1, "#ff1133");
    ctx.fillStyle = grad;
    ctx.fillRect(legendX + 29, 8, 56, 6);
    ctx.fillStyle = "rgba(140,175,210,0.55)";
    ctx.fillText("HOT 70%", legendX + 82, 13);

    // LIVE badge + quote age
    const agoSec =
      updatedAt != null
        ? Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000))
        : null;
    ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
    roundRect(ctx, w - 118, 4, 108, 16, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(16, 185, 129, 0.45)";
    ctx.stroke();
    ctx.fillStyle = "#6ee7b7";
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.fillText("● LIVE 1s", w - 112, 14);
    if (agoSec != null) {
      ctx.fillStyle = "rgba(140,175,210,0.55)";
      ctx.font = "6px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${agoSec}s`, w - 8, 14);
      ctx.textAlign = "left";
    }

    // live column highlight
    const liveBandX = left + chartW * (1 - 0.2);
    ctx.fillStyle = `rgba(0, 229, 255, ${0.03 + pulse * 0.04})`;
    ctx.fillRect(liveBandX, top, chartW * 0.2, mainH);
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.15 + pulse * 0.2})`;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(liveBandX, top);
    ctx.lineTo(liveBandX, top + mainH);
    ctx.stroke();
    ctx.setLineDash([]);

    // crosshair + tooltip
    const mouse = mouseRef.current;
    if (mouse && mouse.x >= left && mouse.x <= left + chartW && mouse.y >= top && mouse.y <= top + mainH) {
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(mouse.x, top);
      ctx.lineTo(mouse.x, top + mainH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(left, mouse.y);
      ctx.lineTo(left + chartW, mouse.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const hoverPrice = yToPrice(mouse.y);
      const tip = hoverPrice.toFixed(2);
      ctx.font = "bold 8px ui-monospace, monospace";
      const tw = ctx.measureText(tip).width + 10;
      roundRect(ctx, axisX + 2, mouse.y - 9, tw, 16, 3);
      ctx.fillStyle = "rgba(20, 28, 40, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 140, 180, 0.5)";
      ctx.stroke();
      ctx.fillStyle = VIZ.cyanBright;
      ctx.fillText(tip, axisX + 7, mouse.y + 3);
    }
  }, [signal, mode, bars, livePrice, clock, flashKey, updatedAt]);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      pulseRef.current = (Math.sin(performance.now() / 320) + 1) / 2;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(draw);
    const canvas = canvasRef.current;
    if (canvas) ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [draw]);

  if (loading && bars.length === 0) {
    return (
      <div className={cn("flex h-full items-center justify-center gap-2 text-sm text-muted", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
        {t("goldSignals.loading")}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full min-h-0 w-full", className)}>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: "block", cursor: "crosshair", background: BG }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }}
        onMouseLeave={() => {
          mouseRef.current = null;
        }}
      />
    </div>
  );
}
