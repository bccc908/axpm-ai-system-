import { NextResponse } from "next/server";
import { planFromStripePriceId } from "@/lib/customer/stripe";
import {
  findAccountByStripeCustomerId,
  findAccountByStripeSubscriptionId,
  setCustomerSubscription,
} from "@/lib/customer/store";
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/customer/types";

function stripeSecret(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

async function verifyStripeSignature(payload: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;

  const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return false;

  const signed = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedHex === sig;
}

function mapStripeStatus(status: string | undefined): SubscriptionStatus {
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "active";
}

export async function POST(request: Request) {
  if (!stripeSecret()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const valid = await verifyStripeSignature(payload, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        metadata?: { user_id?: string; plan?: string };
        client_reference_id?: string;
        customer?: string;
        subscription?: string;
      };
      const userId = String(session.metadata?.user_id ?? session.client_reference_id ?? "");
      const plan = (session.metadata?.plan as SubscriptionPlan | undefined) ?? "basic";
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      if (userId) {
        await setCustomerSubscription(userId, {
          plan,
          status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as {
        id?: string;
        customer?: string;
        status?: string;
        current_period_end?: number;
        metadata?: { user_id?: string };
        items?: { data?: Array<{ price?: { id?: string } }> };
      };
      const subscriptionId = String(sub.id ?? "");
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      const status = mapStripeStatus(String(sub.status ?? ""));
      const priceId = sub.items?.data?.[0]?.price?.id ?? null;
      const plan = planFromStripePriceId(priceId) ?? "basic";
      const periodEnd =
        typeof sub.current_period_end === "number"
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

      const account =
        (await findAccountByStripeSubscriptionId(subscriptionId)) ??
        (customerId ? await findAccountByStripeCustomerId(customerId) : null);

      const userId =
        account?.user_id ?? String(sub.metadata?.user_id ?? "");

      if (userId) {
        await setCustomerSubscription(userId, {
          plan,
          status,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_end: periodEnd,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe webhook]", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
