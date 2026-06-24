"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";

const BAR_POLL_MS: Record<string, number> = {
  "1m": 10_000,
  "5m": 30_000,
};

const QUOTE_POLL_MS = 1_000;

function patchFormingBar(bars: GoldOhlcBar[], price: number | null): GoldOhlcBar[] {
  if (!bars.length || price == null || !Number.isFinite(price)) return bars;
  const last = bars[bars.length - 1];
  const rounded = Math.round(price * 100) / 100;
  if (last.close === rounded && last.high >= rounded && last.low <= rounded) return bars;
  return [
    ...bars.slice(0, -1),
    {
      ...last,
      close: rounded,
      high: Math.max(last.high, rounded),
      low: Math.min(last.low, rounded),
    },
  ];
}

export function useGoldLiveBars(interval: "1m" | "5m" = "1m", enabled = true) {
  const [bars, setBars] = useState<GoldOhlcBar[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [quoteAt, setQuoteAt] = useState<string | null>(null);
  const [clock, setClock] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const prevBarSigRef = useRef("");
  const prevPriceRef = useRef<number | null>(null);
  const hadBarsRef = useRef(false);

  const loadBars = useCallback(async () => {
    if (!enabled) return;
    if (!hadBarsRef.current) setLoading(true);
    try {
      const res = await fetch(`/api/gold-signals/chart?interval=${interval}&_=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.bars)) {
        const next = data.bars as GoldOhlcBar[];
        const last = next.at(-1);
        const sig = last ? `${last.time}:${last.close}:${last.volume}` : "";
        if (sig && sig !== prevBarSigRef.current) {
          prevBarSigRef.current = sig;
          setFlashKey((k) => k + 1);
        }
        setBars(next);
        setUpdatedAt(data.updated_at ?? new Date().toISOString());
        hadBarsRef.current = true;
        if (last) {
          setLivePrice((p) => p ?? last.close);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, interval]);

  const loadQuote = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(`/api/gold-signals/quote?_=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && typeof data.price === "number") {
        const price = data.price as number;
        prevPriceRef.current = price;
        setLivePrice(price);
        setQuoteAt(data.as_of ?? new Date().toISOString());
      }
    } catch {
      /* ignore transient quote errors */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void loadBars();
    void loadQuote();
    const barPoll = window.setInterval(() => void loadBars(), BAR_POLL_MS[interval] ?? 15_000);
    const quotePoll = window.setInterval(() => void loadQuote(), QUOTE_POLL_MS);
    const clockTick = window.setInterval(() => setClock((c) => c + 1), 1000);
    return () => {
      clearInterval(barPoll);
      clearInterval(quotePoll);
      clearInterval(clockTick);
    };
  }, [enabled, interval, loadBars, loadQuote]);

  const liveBars = useMemo(() => patchFormingBar(bars, livePrice), [bars, livePrice]);
  const lastBar = liveBars.at(-1) ?? null;
  const structureLastBar = bars.at(-1) ?? null;

  return {
    /** Patched with live quote — heatmap / ticker */
    bars: liveBars,
    liveBars,
    /** Raw 1m bars from poll — stable footprint grid */
    structureBars: bars,
    loading,
    updatedAt: quoteAt ?? updatedAt,
    lastBar,
    structureLastBar,
    livePrice,
    flashKey,
    clock,
    reload: () => {
      void loadBars();
      void loadQuote();
    },
  };
}
