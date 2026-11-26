import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/api-session", () => ({
  getServerSession: vi.fn(async () => ({
    user: { id: "user-1", email: "c@example.com", name: "C", role: "customer" },
    session: { sub: "user-1", role: "customer", email: "c@example.com", name: "C", exp: 9 },
  })),
}));

vi.mock("@/lib/customer/store", () => ({
  activateTrial: vi.fn(async () => ({ plan: "free", status: "trialing" })),
  getOrCreateCustomerAccount: vi.fn(async () => ({ stripe_customer_id: null })),
  setCustomerSubscription: vi.fn(),
}));

vi.mock("@/lib/customer/stripe", () => ({
  createCheckoutSession: vi.fn(async () => "https://checkout.example/session"),
}));

import { POST } from "@/app/api/account/checkout/route";
import { activateTrial, getOrCreateCustomerAccount, setCustomerSubscription } from "@/lib/customer/store";
import { createCheckoutSession } from "@/lib/customer/stripe";

function request(body: unknown) {
  return new Request("http://127.0.0.1:3000/api/account/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STRIPE_SECRET_KEY;
});

describe("checkout without Stripe", () => {
  it("does not activate a paid plan when Stripe is not configured", async () => {
    const res = await POST(request({ plan: "pro" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/Stripe is not configured/);
    expect(setCustomerSubscription).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(getOrCreateCustomerAccount).not.toHaveBeenCalled();
  });

  it("still allows the free trial path", async () => {
    const res = await POST(request({ plan: "basic", action: "trial" }));
    expect(res.status).toBe(200);
    expect(activateTrial).toHaveBeenCalledWith("user-1");
    expect(setCustomerSubscription).not.toHaveBeenCalled();
  });

  it("starts a Stripe session when Stripe is configured", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    const res = await POST(request({ plan: "basic" }));
    expect(res.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalled();
    expect(setCustomerSubscription).not.toHaveBeenCalled();
    delete process.env.STRIPE_SECRET_KEY;
  });
});
