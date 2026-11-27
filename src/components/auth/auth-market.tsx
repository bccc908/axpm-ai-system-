"use client";

import { createContext, useContext } from "react";
import type { AuthAudience, AuthMarket } from "@/lib/auth/google-policy";

export type AuthMarketValue = {
  audience: AuthAudience;
  market: AuthMarket;
  googleClientId: string | null;
};

const AuthMarketContext = createContext<AuthMarketValue | null>(null);

export function AuthMarketProvider({
  value,
  children,
}: {
  value: AuthMarketValue;
  children: React.ReactNode;
}) {
  return <AuthMarketContext.Provider value={value}>{children}</AuthMarketContext.Provider>;
}

export function useAuthMarket(): AuthMarketValue {
  const value = useContext(AuthMarketContext);
  if (!value) {
    throw new Error("useAuthMarket must be used within AuthMarketProvider");
  }
  return value;
}
