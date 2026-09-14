"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { patchFormingBar, type GoldOhlcBar } from "@/lib/gold-signals/chart-math";

const BAR_POLL_MS: Record<string, number> = {
  "1m": 10_000,
  "5m": 30_000,
};

const QUOTE_POLL_MS = 1_000;

export function useGoldLiveBars(
  apiBase: string,
  interval: "1m" | "5m" = "1m",
  enabled = true,
) {
  const [bars, setBars] = useState<GoldOhlcBar[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [quoteAt, setQuoteAt] = useState<string | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);
  const [spreadLive, setSpreadLive] = useState<{
    xauusd: number;
    xauusdt: number;
    spread: number;
    spread_pct: number;
    xauusd_change_pct: number | null;
    xauusdt_change_pct: number | null;
    leader: "xauusd" | "xauusdt" | "aligned";
  } | null>(null);
  const [clock, setClock] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const prevBarSigRef = useRef("");
  const prevPriceRef = useRef<number | null>(null);
  const hadBarsRef = useRef(false);

  const loadBars = useCallback(async () => {
    if (!enabled) return;
    if (!hadBarsRef.current) setLoading(true);
    try {
      const res = await fetch(`${apiBase}/chart?interval=${interval}&_=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
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
        setSource(typeof data.source === "string" ? data.source : null);
        setStale(Boolean(data.stale));
        setError(next.length === 0 ? "empty" : null);
        setUpdatedAt(data.updated_at ?? new Date().toISOString());
        hadBarsRef.current = next.length > 0;
        if (last) {
          setLivePrice(last.close);
          if (last.close !== prevPriceRef.current) {
            prevPriceRef.current = last.close;
            setFlashKey((k) => k + 1);
          }
        }
      } else {
        setError(typeof data.error === "string" ? data.error : "fetch failed");
        if (!hadBarsRef.current) setBars([]);
      }
    } catch {
      setError("network");
      if (!hadBarsRef.current) setBars([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, enabled, interval]);

  const loadQuote = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(`${apiBase}/quote?_=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && typeof data.price === "number") {
        const price = data.price as number;
        if (price !== prevPriceRef.current) {
          prevPriceRef.current = price;
          setFlashKey((k) => k + 1);
        }
        setLivePrice(price);
        setQuoteAt(data.as_of ?? new Date().toISOString());
        if (typeof data.change_pct === "number" && Number.isFinite(data.change_pct)) {
          setChangePct(data.change_pct);
        }
        if (
          typeof data.xauusd === "number" &&
          typeof data.xauusdt === "number" &&
          typeof data.spread === "number"
        ) {
          setSpreadLive({
            xauusd: data.xauusd,
            xauusdt: data.xauusdt,
            spread: data.spread,
            spread_pct: typeof data.spread_pct === "number" ? data.spread_pct : 0,
            xauusd_change_pct:
              typeof data.xauusd_change_pct === "number" ? data.xauusd_change_pct : null,
            xauusdt_change_pct:
              typeof data.xauusdt_change_pct === "number" ? data.xauusdt_change_pct : null,
            leader:
              data.leader === "xauusd" || data.leader === "xauusdt" || data.leader === "aligned"
                ? data.leader
                : "aligned",
          });
        }
      }
    } catch {
      /* ignore transient quote errors */
    }
  }, [apiBase, enabled]);

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
    error,
    source,
    stale,
    updatedAt: quoteAt ?? updatedAt,
    lastBar,
    structureLastBar,
    livePrice,
    changePct,
    spreadLive,
    flashKey,
    clock,
    reload: () => {
      void loadBars();
      void loadQuote();
    },
  };
}
