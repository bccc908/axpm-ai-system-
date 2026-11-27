import { NextResponse } from "next/server";
import { z } from "zod";
import { authSecretUnavailableResponse } from "@/lib/auth/route-guard";
import { rateLimitResponse } from "@/lib/auth/rate-limit-response";
import { sendVerificationLink } from "@/lib/auth/send-auth-link";
import { startOwnerCustomerAlert } from "@/lib/auth/owner-alert";
import { isMainlandSignupBlocked } from "@/lib/auth/signup-gate";
import { findUserById, needsSetup, registerCustomer } from "@/lib/auth/store";
import { getOrCreateCustomerAccount } from "@/lib/customer/store";
import { resolveReferrer } from "@/lib/referral";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8),
  ref: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const missingSecret = authSecretUnavailableResponse();
  if (missingSecret) return missingSecret;

  if (await needsSetup()) {
    return NextResponse.json(
      { error: "Owner setup required first — use /login to create admin account" },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup data" }, { status: 400 });
  }

  const limited = rateLimitResponse(request, "signup", parsed.data.email);
  if (limited) return limited;

  if (
    isMainlandSignupBlocked({
      country: request.headers.get("cf-ipcountry"),
      enabled: process.env.SIGNUP_BLOCK_MAINLAND === "1",
    })
  ) {
    return NextResponse.json({ error: "Signup is not available" }, { status: 403 });
  }

  try {
    const referrer = await resolveReferrer(parsed.data.ref);
    const user = await registerCustomer(parsed.data);
    const account = await getOrCreateCustomerAccount(user.id, {
      referred_by_user_id: referrer?.id ?? null,
    });
    const stored = await findUserById(user.id);
    startOwnerCustomerAlert({
      event: "signed_up",
      userId: user.id,
      name: user.name,
      email: user.email,
      occurredAt: stored?.created_at ?? new Date().toISOString(),
      plan: account.plan,
      blocked: false,
    });

    let emailSent = false;
    try {
      emailSent = await sendVerificationLink(user.id, false);
    } catch (error) {
      console.error("[signup email]", error instanceof Error ? error.message : "send failed");
    }

    return NextResponse.json({
      ok: true,
      verificationRequired: true,
      emailSent,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 400 },
    );
  }
}
