import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyLogin } from "@/lib/auth/store";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const user = await verifyLogin(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
