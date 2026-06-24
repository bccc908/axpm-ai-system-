import "server-only";

import { isStripeConfigured, stripePriceIdForPlan } from "@/lib/customer/plans";
import type { SubscriptionPlan } from "@/lib/customer/types";

function stripeSecret(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

async function stripeRequest(path: string, body: Record<string, string>) {
  const secret = stripeSecret();
  if (!secret) throw new Error("Stripe not configured");

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });

  const data = (await res.json()) as { url?: string; id?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe error ${res.status}`);
  }
  return data;
}

export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  plan: SubscriptionPlan;
  stripeCustomerId?: string | null;
}) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe not configured");
  }

  const priceId = stripePriceIdForPlan(params.plan);
  if (!priceId) {
    throw new Error(`Stripe price not configured for plan: ${params.plan}`);
  }

  const body: Record<string, string> = {
    mode: "subscription",
    success_url: `${appUrl()}/dashboard/account?checkout=success`,
    cancel_url: `${appUrl()}/dashboard/account?checkout=cancel`,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "client_reference_id": params.userId,
    "customer_email": params.email,
    "metadata[user_id]": params.userId,
    "metadata[plan]": params.plan,
    "subscription_data[metadata][user_id]": params.userId,
    "subscription_data[metadata][plan]": params.plan,
  };

  if (params.stripeCustomerId) {
    delete body.customer_email;
    body.customer = params.stripeCustomerId;
  }

  const session = await stripeRequest("/checkout/sessions", body);
  if (!session.url) throw new Error("Stripe checkout URL missing");
  return session.url;
}

export function planFromStripePriceId(priceId: string | undefined | null): SubscriptionPlan | null {
  if (!priceId) return null;
  const basic = process.env.STRIPE_PRICE_BASIC?.trim();
  const pro = process.env.STRIPE_PRICE_PRO?.trim();
  if (priceId === basic) return "basic";
  if (priceId === pro) return "pro";
  return null;
}
