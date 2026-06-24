import "server-only";

import type { FortuneReading } from "@/types/fortune";
import type { UserRole } from "@/lib/auth/types";
import { brandName } from "@/lib/brand";
import { appPublicUrl, buildCustomerSignupUrl } from "@/lib/referral";
import { buildPublicFortuneShareUrl } from "@/lib/fortune/public-share";

export function shareRequiredForFollowUp(role: UserRole): boolean {
  return role !== "owner" && role !== "admin";
}

export function buildFortuneSharePayload(
  reading: FortuneReading,
  locale: "en" | "zh",
  referrerUserId?: string | null,
  shareToken?: string | null,
) {
  const brand = brandName(locale);
  const signupUrl = referrerUserId
    ? buildCustomerSignupUrl(referrerUserId, locale)
    : `${appPublicUrl()}/signup?lang=${locale}`;
  const viewUrl = shareToken ? buildPublicFortuneShareUrl(shareToken) : null;
  const snippet = reading.summary?.trim() || reading.title;
  const text =
    locale === "zh"
      ? viewUrl
        ? `我在 ${brand} 做了一次${reading.topic === "mianxiang" ? "面相" : "命理"}分析 ✨\n「${snippet}」\n👉 打开看全文：${viewUrl}\n你也来试试：${signupUrl}`
        : `我在 ${brand} 做了一次命理分析，挺准的 ✨\n「${snippet}」\n你也来试试：${signupUrl}`
      : viewUrl
        ? `My ${brand} reading ✨\n"${snippet}"\n👉 Read it: ${viewUrl}\nTry it yourself: ${signupUrl}`
        : `I tried ${brand} for a fortune reading — surprisingly insightful ✨\n"${snippet}"\nTry it: ${signupUrl}`;

  return {
    url: viewUrl ?? signupUrl,
    viewUrl,
    signupUrl,
    text,
    title: locale === "zh" ? `${brand} · 命理分析` : `${brand} · Fortune reading`,
  };
}
