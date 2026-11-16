"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SignalInstrument } from "@/lib/market-signals/instruments";

export type GoldBookLevel = {
  px: number;
  sz: number;
  usd: number;
};

export type GoldBookDepth = {
  symbol: "XAUUSDT" | "XAGUSDT";
  mid: number;
  bids: GoldBookLevel[];
  asks: GoldBookLevel[];
  bid_wall_px: number | null;
  bid_wall_usd: number | null;
  ask_wall_px: number | null;
  ask_wall_usd: number | null;
  depth_10bp_bid_usd: number;
  depth_10bp_ask_usd: number;
  source: string;
  as_of: string;
};

export function goldDepthSymbol(instrument: SignalInstrument): "XAUUSDT" | "XAGUSDT" | null {
  // Compare as string so Mac coins (xag) still resolve if the desk union grows.
  const id = String(instrument);
  if (id === "xag") return "XAGUSDT";
  if (id === "gold" || id === "xau" || id === "spread") return "XAUUSDT";
  return null;
}

export function defaultLiqCoin(instrument: SignalInstrument): "BTC" | "ETH" | "SOL" | "XRP" | "XAU" | "XAG" {
  const id = String(instrument);
  if (id === "xag") return "XAG";
  if (id === "gold" || id === "xau" || id === "spread") return "XAU";
  if (id === "eth") return "ETH";
  if (id === "sol") return "SOL";
  if (id === "xrp") return "XRP";
  return "BTC";
}

export type DeskPrint = {
  time: number;
  px: number;
  side: "buy" | "sell";
  sz: number;
};

export type DeskBookDepth = {
  mid: number;
  bids: GoldBookLevel[];
  asks: GoldBookLevel[];
  bid_wall_px: number | null;
  bid_wall_usd: number | null;
  ask_wall_px: number | null;
  ask_wall_usd: number | null;
  depth_10bp_bid_usd: number;
  depth_10bp_ask_usd: number;
  source: string;
  venue: string;
};

function mergePrints(prev: DeskPrint[], next: DeskPrint[]) {
  const seen = new Set<string>();
  const out: DeskPrint[] = [];
  for (const p of [...next, ...prev]) {
    const key = `${p.time}-${p.px}-${p.side}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.sort((a, b) => b.time - a.time).slice(0, 160);
}

export function useDeskBookDepth(
  instrument: SignalInstrument,
  enabled: boolean,
  refreshEpoch = 0,
) {
  const coin = defaultLiqCoin(instrument);
  const [book, setBook] = useState<DeskBookDepth | null>(null);
  const [prints, setPrints] = useState<DeskPrint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef(false);
  const startedAt = useRef(0);

  const load = useCallback(async (force = false) => {
    if (!enabled) return;
    const now = Date.now();
    if (!force && inflightRef.current && now - startedAt.current < 2_000) return;
    inflightRef.current = true;
    startedAt.current = now;
    try {
      const metal = coin === "XAU" || coin === "XAG";
      const [liqRes, depthRes] = await Promise.all([
        fetch(`/api/liquidity?coin=${coin}&fast=1`, {
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        }).catch(() => null),
        metal
          ? fetch(`/api/gold-signals/depth?symbol=${coin}USDT`, {
              credentials: "include",
              cache: "no-store",
              signal: AbortSignal.timeout(5_000),
            }).catch(() => null)
          : Promise.resolve(null),
      ]);
      const data = (await liqRes?.json().catch(() => null)) as {
        book?: { mid?: number; bid?: number; ask?: number; venue?: string };
        levels?: { bids?: GoldBookLevel[]; asks?: GoldBookLevel[] };
        tape?: {
          bid_wall_px?: number | null;
          bid_wall_usd?: number | null;
          ask_wall_px?: number | null;
          ask_wall_usd?: number | null;
          depth_10bp_bid_usd?: number | null;
          depth_10bp_ask_usd?: number | null;
          source?: string | null;
        };
        error?: string;
        prints?: DeskPrint[];
      } | null;
      const depth = (await depthRes?.json().catch(() => null)) as GoldBookDepth | { error?: string } | null;
      let bids = data?.levels?.bids ?? [];
      let asks = data?.levels?.asks ?? [];
      let mid = data?.book?.mid;
      let venue = data?.book?.venue ?? coin;
      if ((bids.length === 0 || asks.length === 0) && depth && "bids" in depth && depth.bids.length && depth.asks.length) {
        bids = depth.bids;
        asks = depth.asks;
        mid = depth.mid;
        venue = depth.source ?? venue;
      }
      if (data?.prints?.length) setPrints((prev) => mergePrints(prev, data.prints!));
      if (bids.length === 0 || asks.length === 0) {
        setError(data?.error ?? "depth unavailable");
        return;
      }
      mid = mid ?? (bids[0].px + asks[0].px) / 2;
      let bidWall = bids[0];
      let askWall = asks[0];
      for (const lvl of bids) if (lvl.usd > bidWall.usd) bidWall = lvl;
      for (const lvl of asks) if (lvl.usd > askWall.usd) askWall = lvl;
      let depthBid = 0;
      let depthAsk = 0;
      for (const lvl of bids) {
        if (mid > 0 && (mid - lvl.px) / mid <= 0.001) depthBid += lvl.usd;
      }
      for (const lvl of asks) {
        if (mid > 0 && (lvl.px - mid) / mid <= 0.001) depthAsk += lvl.usd;
      }
      setBook({
        mid,
        bids,
        asks,
        bid_wall_px: data?.tape?.bid_wall_px ?? bidWall.px,
        bid_wall_usd: data?.tape?.bid_wall_usd ?? bidWall.usd,
        ask_wall_px: data?.tape?.ask_wall_px ?? askWall.px,
        ask_wall_usd: data?.tape?.ask_wall_usd ?? askWall.usd,
        depth_10bp_bid_usd: data?.tape?.depth_10bp_bid_usd || depthBid,
        depth_10bp_ask_usd: data?.tape?.depth_10bp_ask_usd || depthAsk,
        source: venue,
        venue,
      });
      setError(null);
    } catch {
      setError("depth unavailable");
    } finally {
      inflightRef.current = false;
    }
  }, [coin, enabled]);

  const tapeInflight = useRef(false);
  const loadTape = useCallback(async () => {
    if (!enabled || (coin !== "XAU" && coin !== "XAG") || tapeInflight.current) return;
    tapeInflight.current = true;
    try {
      const tapeRes = await fetch("/api/gold-signals/tape?n=150", {
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      });
      const tape = (await tapeRes.json().catch(() => null)) as { prints?: DeskPrint[] } | null;
      if (tape?.prints?.length) setPrints((prev) => mergePrints(prev, tape.prints!));
    } catch {
      /* keep last prints */
    } finally {
      tapeInflight.current = false;
    }
  }, [coin, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load(refreshEpoch > 0);
    void loadTape();
    const bookTimer = window.setInterval(() => void load(), 2_000);
    const tapeTimer = window.setInterval(() => void loadTape(), 1_500);
    return () => {
      window.clearInterval(bookTimer);
      window.clearInterval(tapeTimer);
    };
  }, [enabled, load, loadTape, refreshEpoch]);

  return { book, error, coin, prints };
}

export function useGoldBookDepth(instrument: SignalInstrument, enabled: boolean) {
  const symbol = goldDepthSymbol(instrument);
  const [book, setBook] = useState<GoldBookDepth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!symbol || !enabled) return;
    try {
      const res = await fetch(`/api/gold-signals/depth?symbol=${symbol}`, { credentials: "include" });
      const data = (await res.json().catch(() => null)) as GoldBookDepth | { error?: string } | null;
      if (!res.ok || !data || !("bids" in data)) {
        setError(data && "error" in data ? data.error ?? "depth unavailable" : "depth unavailable");
        return;
      }
      setBook(data);
      setError(null);
    } catch {
      setError("depth unavailable");
    }
  }, [symbol, enabled]);

  useEffect(() => {
    if (!symbol || !enabled) return;
    void load();
    const timer = window.setInterval(() => void load(), 800);
    return () => clearInterval(timer);
  }, [symbol, enabled, load]);

  return { book, error, symbol };
}
