import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
