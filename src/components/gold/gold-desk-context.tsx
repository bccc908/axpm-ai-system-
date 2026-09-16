"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGoldLiveBars } from "@/components/gold/use-gold-live-bars";
import { seedCryptoBars, useCryptoWsMarket } from "@/components/gold/use-crypto-ws-market";
import { useHlWsMarket } from "@/components/gold/use-hl-ws-market";
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
  const hlWs = useHlWsMarket(instrument === "hl");

  const merged = useMemo(() => {
    const feed = instrument === "hl" ? hlWs : config.wsPair ? cryptoWs : null;
    if (!feed) return server;

    const wsPrice = feed.price;
    const useWs = feed.connected || wsPrice != null;
    const seedPair = config.wsPair ?? "btcusdt";
    const effectiveBars =
      feed.bars.length >= 4
        ? feed.bars
        : wsPrice != null
          ? seedCryptoBars(wsPrice, 90, seedPair)
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
      changePct: feed.changePct ?? server.changePct,
      flashKey: Math.max(server.flashKey, feed.flashKey),
      updatedAt: feed.updatedAt ?? server.updatedAt,
      source: feed.source ?? server.source,
      stale: useWs ? false : server.stale,
      error: useWs && effectiveBars.length >= 4 ? null : server.error,
      loading: useWs && effectiveBars.length >= 4 ? false : server.loading,
    };
  }, [config.wsPair, server, cryptoWs, hlWs, instrument]);

  return (
    <GoldDeskContext.Provider
      value={{
        ...merged,
        instrument,
        apiBase: config.apiBase,
        priceTick: config.priceTick,
        badge: config.badge,
        dataSource: (instrument === "hl" ? hlWs.source : cryptoWs.source) ?? config.dataSource,
        wsConnected: instrument === "hl" ? hlWs.connected : config.wsPair ? cryptoWs.connected : false,
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
