import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { rolesForRule, matchApiRule, OWNER_ADMIN } from "@/lib/auth/api-policy";
import { AuthSecretError, assertAuthSecretConfigured, cronRequestAuthorized } from "@/lib/auth/secrets";
import type { UserRole } from "@/lib/auth/types";

export { OWNER_ADMIN };

export function authSecretUnavailableResponse(): NextResponse | null {
  try {
    assertAuthSecretConfigured();
    return null;
  } catch (error) {
    if (error instanceof AuthSecretError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}

export async function requireRoles(roles: readonly UserRole[]) {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!roles.includes(ctx.user.role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, ctx };
}

/** Session gate that uses the same role list as the middleware map. */
export async function requireMappedSession(pathname: string) {
  const rule = matchApiRule(pathname);
  const roles = rule ? rolesForRule(rule) : null;
  if (!roles) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return requireRoles(roles);
}

export async function allowCronOrRoles(request: Request, roles: readonly UserRole[]) {
  if (cronRequestAuthorized(request)) return true;
  const ctx = await getServerSession();
  return Boolean(ctx && roles.includes(ctx.user.role));
}
