import "server-only";

import { findUserById } from "@/lib/auth/store";
import type { Locale } from "@/lib/i18n/types";

export function appPublicUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://talent.kaydenchiew.com";
}

/** Customer signup link attributed to referrer (your user id). */
export function buildCustomerSignupUrl(referrerUserId: string, locale?: Locale): string {
  const params = new URLSearchParams({ ref: referrerUserId });
  if (locale) params.set("lang", locale);
  return `${appPublicUrl()}/signup?${params.toString()}`;
}

export async function resolveReferrer(ref: string | null | undefined): Promise<{
  id: string;
  name: string;
} | null> {
  if (!ref?.trim()) return null;
  const user = await findUserById(ref.trim());
  if (!user?.is_active) return null;
  return { id: user.id, name: user.name };
}
