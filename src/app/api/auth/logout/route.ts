import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "@/lib/auth/session";
import { CUSTOMER_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth/types";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cleared = sessionCookieOptions(0, request);
  cookieStore.set(SESSION_COOKIE, "", cleared);
  cookieStore.set(CUSTOMER_SESSION_COOKIE, "", cleared);
  return NextResponse.json({ ok: true });
}
