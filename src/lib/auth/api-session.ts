import "server-only";

import { cookies, headers } from "next/headers";
import { loginSpaceForRole, pickLoginSession, sessionLoginSpace } from "@/lib/auth/login-space";
import { readLoginSessions } from "@/lib/auth/login-sessions";
import { findUserById } from "@/lib/auth/store";
import type { AuthUserPublic, UserRole } from "@/lib/auth/types";

export async function readRequestLoginSessions() {
  const cookieStore = await cookies();
  return readLoginSessions((name) => cookieStore.get(name)?.value);
}

export async function getServerSession() {
  const headerStore = await headers();
  const pathname = headerStore.get("x-kc-pathname") ?? "";
  const { staff, customer } = await readRequestLoginSessions();
  const session = pickLoginSession(pathname, staff, customer);
  if (!session) return null;

  const user = await findUserById(session.sub);
  if (!user) return null;
  const tokenSpace = sessionLoginSpace(session);
  if (!tokenSpace || tokenSpace !== loginSpaceForRole(user.role)) return null;

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
