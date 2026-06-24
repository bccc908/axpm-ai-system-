import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import {
  activateTrial,
  getOrCreateCustomerAccount,
  setCustomerSubscription,
} from "@/lib/customer/store";
import { createCheckoutSession } from "@/lib/customer/stripe";
import { isStripeConfigured } from "@/lib/customer/plans";

const schema = z.object({
  plan: z.enum(["basic", "pro"]),
  action: z.enum(["checkout", "trial"]).optional(),
});

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }

  const account = await getOrCreateCustomerAccount(ctx.user.id);

  if (parsed.data.action === "trial") {
    const updated = await activateTrial(ctx.user.id);
    return NextResponse.json({ ok: true, account: updated, trial: true });
  }

  if (!isStripeConfigured()) {
    const updated = await setCustomerSubscription(ctx.user.id, {
      plan: parsed.data.plan,
      status: "active",
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    return NextResponse.json({
      ok: true,
      account: updated,
      manual: true,
      message: "Stripe not configured — plan activated manually for 30 days",
    });
  }

  try {
    const url = await createCheckoutSession({
      userId: ctx.user.id,
      email: ctx.user.email,
      plan: parsed.data.plan,
      stripeCustomerId: account.stripe_customer_id,
    });
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 400 },
    );
  }
}
