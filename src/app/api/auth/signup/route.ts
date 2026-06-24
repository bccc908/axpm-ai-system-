import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { needsSetup, registerCustomer } from "@/lib/auth/store";
import { getOrCreateCustomerAccount } from "@/lib/customer/store";
import { resolveReferrer } from "@/lib/referral";
import { cookies } from "next/headers";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8),
  ref: z.string().uuid().optional(),
});

export async function POST(request: Request) {
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

  try {
    const referrer = await resolveReferrer(parsed.data.ref);
    const user = await registerCustomer(parsed.data);
    await getOrCreateCustomerAccount(user.id, {
      referred_by_user_id: referrer?.id ?? null,
    });

    const token = await createSessionToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());

    return NextResponse.json({ ok: true, user, referredBy: referrer?.name ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 400 },
    );
  }
}
