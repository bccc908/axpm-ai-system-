import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loginSpaceForRole, sessionLoginSpace } from "@/lib/auth/login-space";
import { rateLimitResponse } from "@/lib/auth/rate-limit-response";
import { authSecretUnavailableResponse } from "@/lib/auth/route-guard";
import { createSessionToken, sessionCookieOptions, verifySessionToken } from "@/lib/auth/session";
import { verifyLogin } from "@/lib/auth/store";
import { CUSTOMER_SESSION_COOKIE, SESSION_COOKIE, type LoginSpace } from "@/lib/auth/types";
import { isEmailVerified } from "@/lib/auth/verification";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const INVALID = { error: "Invalid email or password" };

export async function performLogin(request: Request, space: LoginSpace) {
  const missingSecret = authSecretUnavailableResponse();
  if (missingSecret) return missingSecret;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(INVALID, { status: 400 });
  }

  const limited = rateLimitResponse(request, "login", parsed.data.email);
  if (limited) return limited;

  const user = await verifyLogin(parsed.data.email, parsed.data.password);
  // Same response as a bad password, so the wrong login page does not reveal the account.
  if (!user || loginSpaceForRole(user.role) !== space) {
    return NextResponse.json(INVALID, { status: 401 });
  }

  if (!isEmailVerified(user)) {
    return NextResponse.json(
      { error: "Verify your email before signing in", code: "email_unverified" },
      { status: 403 },
    );
  }

  const token = await createSessionToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    space,
  });

  const cookieStore = await cookies();
  if (space === "customer") {
    const existing = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
    if (existing && sessionLoginSpace(existing) === "customer") {
      cookieStore.set(SESSION_COOKIE, "", sessionCookieOptions(0, request));
    }
    cookieStore.set(CUSTOMER_SESSION_COOKIE, token, sessionCookieOptions(undefined, request));
  } else {
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(undefined, request));
  }

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
