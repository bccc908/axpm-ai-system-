import { isMainlandChina } from "@/lib/i18n/locale-detect";

export type AuthAudience = "customer" | "staff";
export type AuthMarket = "china" | "global";

export function authMarketFromCountry(country: string | null | undefined): AuthMarket {
  return isMainlandChina(country) ? "china" : "global";
}

/**
 * Google is a customer / global control only.
 * Mainland China, staff login, and a missing client id or secret all hide it.
 */
export function showGoogleSignIn(input: {
  audience: AuthAudience;
  country: string | null | undefined;
  clientId?: string | null;
  clientSecretConfigured: boolean;
}): boolean {
  if (input.audience !== "customer") return false;
  if (isMainlandChina(input.country)) return false;
  if (!input.clientId?.trim()) return false;
  if (!input.clientSecretConfigured) return false;
  return true;
}
