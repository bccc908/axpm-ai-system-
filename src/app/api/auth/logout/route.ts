import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", sessionCookieOptions(0, request));
  return NextResponse.json({ ok: true });
}
