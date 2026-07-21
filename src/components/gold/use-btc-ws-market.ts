"use client";

import { useEffect, useRef, useState } from "react";
import type { GoldOhlcBar } from "@/lib/gold-signals/chart-math";

const BINANCE_STREAMS = [
  "wss://stream.binance.com:9443/stream?streams=btcusdt@trade/btcusdt@kline_1m",
  "wss://data-stream.binance.vision/stream?streams=btcusdt@trade/btcusdt@kline_1m",
];

type BtcWsMarket = {
  price: number | null;
  bars: GoldOhlcBar[];
  changePct: number | null;
  connected: boolean;
  source: string | null;
  flashKey: number;
  updatedAt: string | null;
};

export function seedBtcBars(spot: number, count = 90): GoldOhlcBar[] {
  const now = Math.floor(Date.now() / 1000);
  const step = 60;
  const bars: GoldOhlcBar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * step;
    const wobble = Math.sin(i / 5) * 45 + Math.cos(i / 8) * 35;
    const open = i === count - 1 ? spot - wobble : bars[bars.length - 1].close;
    const close = spot + wobble;
    bars.push({
      time: t - (t % step),
      open: Math.round(open * 100) / 100,
      high: Math.round((Math.max(open, close) + 25) * 100) / 100,
      low: Math.round((Math.min(open, close) - 25) * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: 100 + ((i * 17) % 90),
    });
  }
  return bars;
}

function parseKline(data: Record<string, unknown>): GoldOhlcBar | null {
  const k = data.k as Record<string, unknown> | undefined;
  if (!k) return null;
  const open = Number(k.o);
  const high = Number(k.h);
  const low = Number(k.l);
  const close = Number(k.c);
  const volume = Number(k.v);
  const time = Math.floor(Number(k.t) / 1000);
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

/** Browser WebSocket feed — works when server cannot reach exchanges (e.g. CN network). */
export function useBtcWsMarket(enabled: boolean): BtcWsMarket {
  const [price, setPrice] = useState<number | null>(null);
  const [bars, setBars] = useState<GoldOhlcBar[]>([]);
  const [changePct, setChangePct] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const barsRef = useRef<GoldOhlcBar[]>([]);
  const open24hRef = useRef<number | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let alive = true;
    let ws: WebSocket | null = null;
    let urlIdx = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const pushPrice = (p: number) => {
      if (!Number.isFinite(p)) return;
      const rounded = Math.round(p * 100) / 100;
      if (rounded !== prevPriceRef.current) {
        prevPriceRef.current = rounded;
        setFlashKey((k) => k + 1);
      }
      setPrice(rounded);
      setUpdatedAt(new Date().toISOString());
      if (open24hRef.current && open24hRef.current > 0) {
        setChangePct(Math.round(((rounded - open24hRef.current) / open24hRef.current) * 10000) / 100);
      }
      if (barsRef.current.length < 4) {
        const seeded = seedBtcBars(rounded);
        barsRef.current = seeded;
        setBars(seeded);
        open24hRef.current = seeded[0]?.open ?? rounded;
      } else {
        // Keep last bar close in sync with live trades
        const list = barsRef.current;
        const last = list.at(-1);
        if (last) {
          const updated = { ...last, close: rounded, high: Math.max(last.high, rounded), low: Math.min(last.low, rounded) };
          list[list.length - 1] = updated;
          barsRef.current = [...list];
          setBars(barsRef.current);
        }
      }
    };

    const pushKline = (bar: GoldOhlcBar) => {
      if (barsRef.current.length < 4) {
        const seeded = seedBtcBars(bar.close);
        barsRef.current = seeded;
        setBars(seeded);
        open24hRef.current ??= seeded[0]?.open ?? bar.close;
        return;
      }
      const list = barsRef.current;
      const last = list.at(-1);
      if (last && last.time === bar.time) {
        list[list.length - 1] = bar;
      } else if (!last || bar.time > last.time) {
        list.push(bar);
        if (list.length > 500) list.splice(0, list.length - 500);
      } else {
        const idx = list.findIndex((b) => b.time === bar.time);
        if (idx >= 0) list[idx] = bar;
      }
      barsRef.current = [...list];
      setBars(barsRef.current);
    };

    const connect = () => {
      if (!alive || urlIdx >= BINANCE_STREAMS.length) return;
      const url = BINANCE_STREAMS[urlIdx];
      try {
        ws = new WebSocket(url);
      } catch {
        urlIdx++;
        retryTimer = setTimeout(connect, 2000);
        return;
      }

      ws.onopen = () => {
        setConnected(true);
        setSource("Binance WS");
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            stream?: string;
            data?: Record<string, unknown>;
          };
          const data = msg.data;
          if (!data) return;
          if (msg.stream?.includes("trade") || data.e === "trade") {
            pushPrice(Number(data.p));
          }
          if (msg.stream?.includes("kline") || data.e === "kline") {
            const bar = parseKline(data);
            if (bar) {
              pushKline(bar);
              pushPrice(bar.close);
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
        urlIdx++;
        if (urlIdx < BINANCE_STREAMS.length) {
          retryTimer = setTimeout(connect, 1500);
        } else {
          urlIdx = 0;
          retryTimer = setTimeout(connect, 5000);
        }
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
