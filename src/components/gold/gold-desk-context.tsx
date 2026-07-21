"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGoldLiveBars } from "@/components/gold/use-gold-live-bars";
import { seedCryptoBars, useCryptoWsMarket } from "@/components/gold/use-crypto-ws-market";
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
  const cryptoWs = useCryptoWsMarket(config.wsPair);

  const merged = useMemo(() => {
    if (!config.wsPair) return server;

    const wsPrice = cryptoWs.price;
    const useWs = cryptoWs.connected || wsPrice != null;
    const effectiveBars =
      cryptoWs.bars.length >= 4
        ? cryptoWs.bars
        : wsPrice != null
          ? seedCryptoBars(wsPrice, 90, config.wsPair)
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
      changePct: cryptoWs.changePct ?? server.changePct,
      flashKey: Math.max(server.flashKey, cryptoWs.flashKey),
      updatedAt: cryptoWs.updatedAt ?? server.updatedAt,
      source: cryptoWs.source ?? server.source,
      stale: useWs ? false : server.stale,
      error: useWs && effectiveBars.length >= 4 ? null : server.error,
      loading: useWs && effectiveBars.length >= 4 ? false : server.loading,
    };
  }, [config.wsPair, server, cryptoWs]);

  return (
    <GoldDeskContext.Provider
      value={{
        ...merged,
        instrument,
        apiBase: config.apiBase,
        priceTick: config.priceTick,
        badge: config.badge,
        dataSource: cryptoWs.source ?? config.dataSource,
        wsConnected: config.wsPair ? cryptoWs.connected : false,
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
