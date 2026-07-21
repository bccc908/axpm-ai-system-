"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGoldLiveBars } from "@/components/gold/use-gold-live-bars";
import { seedBtcBars, useBtcWsMarket } from "@/components/gold/use-btc-ws-market";
import {
  SIGNAL_INSTRUMENTS,
  type SignalInstrument,
} from "@/lib/market-signals/instruments";

type GoldDeskContextValue = ReturnType<typeof useGoldLiveBars> & {
  instrument: SignalInstrument;
  apiBase: string;
  priceTick: number;
  badge: string;
  dataSource: string;
  wsConnected: boolean;
};

const GoldDeskContext = createContext<GoldDeskContextValue | null>(null);

export function GoldDeskProvider({
  instrument,
  children,
}: {
  instrument: SignalInstrument;
  children: ReactNode;
}) {
  const config = SIGNAL_INSTRUMENTS[instrument];
  const server = useGoldLiveBars(config.apiBase, "1m", true);
  const btcWs = useBtcWsMarket(instrument === "btc");

  const merged = useMemo(() => {
    if (instrument !== "btc") return server;

    const wsPrice = btcWs.price;
    const useWs = btcWs.connected || wsPrice != null;
    const effectiveBars =
      btcWs.bars.length >= 4
        ? btcWs.bars
        : wsPrice != null
          ? seedBtcBars(wsPrice)
          : server.structureBars;
    const last = effectiveBars.at(-1) ?? null;

    return {
      ...server,
      livePrice: wsPrice ?? server.livePrice,
      bars: effectiveBars.length > 0 ? effectiveBars : server.bars,
      liveBars: effectiveBars.length > 0 ? effectiveBars : server.liveBars,
      structureBars: effectiveBars,
      structureLastBar: last ?? server.structureLastBar,
      lastBar: last ?? server.lastBar,
      changePct: btcWs.changePct ?? server.changePct,
      flashKey: Math.max(server.flashKey, btcWs.flashKey),
      updatedAt: btcWs.updatedAt ?? server.updatedAt,
      source: btcWs.source ?? server.source,
      stale: useWs ? false : server.stale,
      error: useWs && effectiveBars.length >= 4 ? null : server.error,
      loading: useWs && effectiveBars.length >= 4 ? false : server.loading,
    };
  }, [instrument, server, btcWs]);

  return (
    <GoldDeskContext.Provider
      value={{
        ...merged,
        instrument,
        apiBase: config.apiBase,
        priceTick: config.priceTick,
        badge: config.badge,
        dataSource: btcWs.source ?? config.dataSource,
        wsConnected: instrument === "btc" ? btcWs.connected : false,
      }}
    >
      {children}
    </GoldDeskContext.Provider>
  );
}

export function useGoldDesk() {
  const ctx = useContext(GoldDeskContext);
  if (!ctx) throw new Error("useGoldDesk must be used within GoldDeskProvider");
  return ctx;
}
