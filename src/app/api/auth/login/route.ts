import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { authSecretUnavailableResponse } from "@/lib/auth/route-guard";
import { rateLimitResponse } from "@/lib/auth/rate-limit-response";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { verifyLogin } from "@/lib/auth/store";
import { isEmailVerified } from "@/lib/auth/verification";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const missingSecret = authSecretUnavailableResponse();
  if (missingSecret) return missingSecret;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const limited = rateLimitResponse(request, "login", parsed.data.email);
  if (limited) return limited;

  const user = await verifyLogin(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
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
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(undefined, request));

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
