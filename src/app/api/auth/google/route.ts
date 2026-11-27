import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleGoogleSignIn } from "@/lib/auth/google-handler";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const result = await handleGoogleSignIn(request);
  if (result.user) {
    const token = await createSessionToken({
      sub: result.user.id,
      role: result.user.role,
      email: result.user.email,
      name: result.user.name,
    });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(undefined, request));
  }
  return NextResponse.json(result.body, { status: result.status });
}
