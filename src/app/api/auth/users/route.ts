import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import type { UserRole } from "@/lib/auth/types";
import { createUser } from "@/lib/auth/store";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const roleSchema = z.enum(["admin", "sales", "finance", "personal", "viewer"]);

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8),
  role: roleSchema,
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user data" }, { status: 400 });
  }

  try {
    const user = await createUser(parsed.data as {
      email: string;
      name: string;
      password: string;
      role: UserRole;
    });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Create failed" },
      { status: 400 },
    );
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || (session.role !== "owner" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { listUsers, toPublicUser } = await import("@/lib/auth/store");
  const users = await listUsers();
  return NextResponse.json({ users: users.map(toPublicUser) });
}
