import type { SubscriptionPlan } from "@/lib/customer/types";

export const PLAN_CONFIG: Record<
  SubscriptionPlan,
  {
    readingsPerDay: number;
    label: { en: string; zh: string };
    priceLabel: { en: string; zh: string };
    stripePriceEnv: string;
  }
> = {
  free: {
    readingsPerDay: 2,
    label: { en: "Free", zh: "免费" },
    priceLabel: { en: "Free", zh: "免费" },
    stripePriceEnv: "",
  },
  basic: {
    readingsPerDay: 10,
    label: { en: "Basic", zh: "基础版" },
    priceLabel: { en: "RM 29 / month", zh: "RM 29 / 月" },
    stripePriceEnv: "STRIPE_PRICE_BASIC",
  },
  pro: {
    readingsPerDay: 50,
    label: { en: "Pro", zh: "专业版" },
    priceLabel: { en: "RM 99 / month", zh: "RM 99 / 月" },
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
};

export function readingsLimitForPlan(plan: SubscriptionPlan): number {
  return PLAN_CONFIG[plan]?.readingsPerDay ?? 2;
}

export function stripePriceIdForPlan(plan: SubscriptionPlan): string | null {
  const envKey = PLAN_CONFIG[plan]?.stripePriceEnv;
  if (!envKey) return null;
  return process.env[envKey]?.trim() || null;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
