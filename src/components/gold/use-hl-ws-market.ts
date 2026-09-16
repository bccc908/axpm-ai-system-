"use client";

import { useEffect, useRef, useState } from "react";
import { seedCryptoBars } from "@/components/gold/use-crypto-ws-market";
import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";

const WS_URL = "wss://api.hyperliquid.xyz/ws";

type HlWsMarket = {
  price: number | null;
  bars: GoldOhlcBar[];
  changePct: number | null;
  connected: boolean;
  source: string | null;
  flashKey: number;
  updatedAt: string | null;
};

function parseCandle(data: Record<string, unknown>): GoldOhlcBar | null {
  const open = Number(data.o);
  const high = Number(data.h);
  const low = Number(data.l);
  const close = Number(data.c);
  const volume = Number(data.v);
  const time = Math.floor(Number(data.t) / 1000);
  if (!Number.isFinite(open + high + low + close) || !time) return null;
  return {
    time,
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    close: Math.round(close * 100) / 100,
    volume: Math.round(volume),
  };
}

export function useHlWsMarket(enabled: boolean): HlWsMarket {
  const [price, setPrice] = useState<number | null>(null);
  const [bars, setBars] = useState<GoldOhlcBar[]>([]);
  const [changePct, setChangePct] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const barsRef = useRef<GoldOhlcBar[]>([]);
  const prevPriceRef = useRef<number | null>(null);
  const openRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let alive = true;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    barsRef.current = [];
    prevPriceRef.current = null;
    openRef.current = null;
    setPrice(null);
    setBars([]);
    setChangePct(null);
    setConnected(false);
    setSource(null);

    const pushPrice = (p: number) => {
      if (!Number.isFinite(p) || p <= 0) return;
      const rounded = Math.round(p * 100) / 100;
      if (rounded !== prevPriceRef.current) {
        prevPriceRef.current = rounded;
        setFlashKey((k) => k + 1);
      }
      setPrice(rounded);
      setUpdatedAt(new Date().toISOString());
      if (openRef.current && openRef.current > 0) {
        setChangePct(Math.round(((rounded - openRef.current) / openRef.current) * 10000) / 100);
      }
      if (barsRef.current.length < 4) {
        const seeded = seedCryptoBars(rounded, 90, "btcusdt");
        barsRef.current = seeded;
        setBars(seeded);
        openRef.current = seeded[0]?.open ?? rounded;
      } else {
        const list = barsRef.current;
        const last = list.at(-1);
        if (last) {
          list[list.length - 1] = {
            ...last,
            close: rounded,
            high: Math.max(last.high, rounded),
            low: Math.min(last.low, rounded),
          };
          barsRef.current = [...list];
          setBars(barsRef.current);
        }
      }
    };

    const pushKline = (bar: GoldOhlcBar) => {
      if (barsRef.current.length < 4) {
        const seeded = seedCryptoBars(bar.close, 90, "btcusdt");
        barsRef.current = seeded;
        setBars(seeded);
        openRef.current ??= seeded[0]?.open ?? bar.close;
        return;
      }
      const list = barsRef.current;
      const last = list.at(-1);
      if (last && last.time === bar.time) list[list.length - 1] = bar;
      else if (!last || bar.time > last.time) {
        list.push(bar);
        if (list.length > 500) list.splice(0, list.length - 500);
      }
      barsRef.current = [...list];
      setBars(barsRef.current);
    };

    const connect = () => {
      if (!alive) return;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        retryTimer = setTimeout(connect, 3000);
        return;
      }

      ws.onopen = () => {
        setConnected(true);
        setSource("Hyperliquid WS");
        ws?.send(JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } }));
        ws?.send(
          JSON.stringify({
            method: "subscribe",
            subscription: { type: "candle", coin: "BTC", interval: "1m" },
          }),
        );
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            channel?: string;
            data?: unknown;
          };
          if (msg.channel === "allMids") {
            const mids = (msg.data as { mids?: Record<string, string> })?.mids;
            if (mids?.BTC) pushPrice(Number(mids.BTC));
          }
          if (msg.channel === "candle") {
            const raw = Array.isArray(msg.data) ? msg.data[0] : msg.data;
            if (raw && typeof raw === "object") {
              const bar = parseCandle(raw as Record<string, unknown>);
              if (bar) {
                pushKline(bar);
                pushPrice(bar.close);
              }
            }
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => ws?.close();
      ws.onclose = () => {
        setConnected(false);
        if (!alive) return;
        retryTimer = setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [enabled]);

  return { price, bars, changePct, connected, source, flashKey, updatedAt };
}
