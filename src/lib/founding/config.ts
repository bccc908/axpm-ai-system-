/**
 * Founding-customer waitlist: feature flag and go-live gate.
 *
 * The waitlist stays a PREVIEW (no sign-up is stored, sent or logged) unless
 * EVERY condition below is true. The flag alone is not enough.
 *   1. FOUNDING_WAITLIST_OPEN === "true" (defaults OFF).
 *   2. Compliance gate C-W1 cleared: the lawyer's interim notice (English + BM)
 *      is live, recorded as FOUNDING_CW1_CLEARED === "true".
 *   3. Every seller placeholder is filled (FOUNDING_SELLER_* env values).
 *   4. No unresolved copy placeholder is left in the page copy.
 *   5. A separate waitlist store exists (see ./store.ts). Today there is none.
 */
import { unresolvedCopyItems } from "./copy";
import { getFoundingWaitlistStore } from "./store";

export const FOUNDING_FLAG_ENV = "FOUNDING_WAITLIST_OPEN";
export const FOUNDING_CW1_ENV = "FOUNDING_CW1_CLEARED";

export const SELLER_KEYS = [
  "SELLER_LEGAL_NAME",
  "SELLER_REG_NO",
  "SELLER_ADDRESS",
  "SUPPORT_EMAIL",
  "PRIVACY_URL",
  "TERMS_URL",
] as const;
export type SellerKey = (typeof SELLER_KEYS)[number];

export const SELLER_ENV: Record<SellerKey, string> = {
  SELLER_LEGAL_NAME: "FOUNDING_SELLER_LEGAL_NAME",
  SELLER_REG_NO: "FOUNDING_SELLER_REG_NO",
  SELLER_ADDRESS: "FOUNDING_SELLER_ADDRESS",
  SUPPORT_EMAIL: "FOUNDING_SUPPORT_EMAIL",
  PRIVACY_URL: "FOUNDING_PRIVACY_URL",
  TERMS_URL: "FOUNDING_TERMS_URL",
};

type Env = Record<string, string | undefined>;

/** A value counts as filled only if it is non-empty and not itself a placeholder. */
function filled(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/\{\{|\}\}|\[TBD|【待定|待确认|TODO-COPY|lorem/i.test(v)) return null;
  return v;
}

export function sellerValue(key: SellerKey, env: Env = process.env): string | null {
  return filled(env[SELLER_ENV[key]]);
}

export function missingSellerKeys(env: Env = process.env): SellerKey[] {
  return SELLER_KEYS.filter((k) => sellerValue(k, env) === null);
}

export function waitlistFlagOn(env: Env = process.env): boolean {
  return env[FOUNDING_FLAG_ENV] === "true";
}

export type WaitlistGate = { open: boolean; reasons: string[] };

export function waitlistGate(env: Env = process.env): WaitlistGate {
  const reasons: string[] = [];
  if (!waitlistFlagOn(env)) reasons.push(`${FOUNDING_FLAG_ENV} is not "true" (default OFF)`);
  if (env[FOUNDING_CW1_ENV] !== "true") reasons.push("Compliance gate C-W1 not cleared");
  const missing = missingSellerKeys(env);
  if (missing.length) reasons.push(`seller placeholders unfilled: ${missing.join(", ")}`);
  const copy = unresolvedCopyItems();
  if (copy.length) reasons.push(`${copy.length} unresolved copy placeholders`);
  if (!getFoundingWaitlistStore()) reasons.push("no separate waitlist store configured");
  return { open: reasons.length === 0, reasons };
}
