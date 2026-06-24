import "server-only";

import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/store";
import type { AuthUserPublic, UserRole } from "@/lib/auth/types";

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await findUserById(session.sub);
  if (!user) return null;

  return {
    session,
    user,
  };
}

export async function requireServerSession() {
  const ctx = await getServerSession();
  if (!ctx) return null;
  return ctx;
}

export function usesPersonalFortuneStore(role: UserRole): boolean {
  return role === "customer";
}

export function requiresSubscriptionGate(role: UserRole): boolean {
  return role === "customer";
}

export function toSessionUser(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}): AuthUserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
