import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createOwnerAccount, needsSetup } from "@/lib/auth/store";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  if (!(await needsSetup())) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid setup data" }, { status: 400 });
  }

  try {
    const user = await createOwnerAccount(parsed.data);
    const token = await createSessionToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 400 },
    );
  }
}
