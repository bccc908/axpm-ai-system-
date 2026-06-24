"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGoldLiveBars } from "@/components/gold/use-gold-live-bars";

type GoldDeskContextValue = ReturnType<typeof useGoldLiveBars>;

const GoldDeskContext = createContext<GoldDeskContextValue | null>(null);

export function GoldDeskProvider({ children }: { children: ReactNode }) {
  const live = useGoldLiveBars("1m", true);
  return <GoldDeskContext.Provider value={live}>{children}</GoldDeskContext.Provider>;
}

export function useGoldDesk() {
  const ctx = useContext(GoldDeskContext);
  if (!ctx) throw new Error("useGoldDesk must be used within GoldDeskProvider");
  return ctx;
}
