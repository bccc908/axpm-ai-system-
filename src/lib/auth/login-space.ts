import { matchApiRule } from "@/lib/auth/api-policy";
import { moduleForPath, roleCanAccessModule, roleCanAccessPath } from "@/lib/auth/permissions";
import type { LoginSpace, SessionPayload, UserRole } from "@/lib/auth/types";

export const STAFF_LOGIN_PATH = "/login";
export const CUSTOMER_LOGIN_PATH = "/customer/login";
export const STAFF_HOME_PATH = "/dashboard";
export const CUSTOMER_HOME_PATH = "/dashboard/account";

export function loginSpaceForRole(role: UserRole): LoginSpace {
  return role === "customer" ? "customer" : "staff";
}

/** Role and an explicit space claim must agree. Older tokens omit space and follow the role. */
export function sessionLoginSpace(payload: { role: UserRole; space?: LoginSpace }): LoginSpace | null {
  const fromRole = loginSpaceForRole(payload.role);
  if (payload.space && payload.space !== fromRole) return null;
  return fromRole;
}

export function loginPathForSpace(space: LoginSpace): string {
  return space === "customer" ? CUSTOMER_LOGIN_PATH : STAFF_LOGIN_PATH;
}

export function homePathForSpace(space: LoginSpace): string {
  return space === "customer" ? CUSTOMER_HOME_PATH : STAFF_HOME_PATH;
}

/** Logged-out visits to these paths go to the customer login. Everything else goes to staff. */
export function loginSpaceForPath(pathname: string): LoginSpace {
  if (pathname === CUSTOMER_LOGIN_PATH || pathname.startsWith(`${CUSTOMER_LOGIN_PATH}/`)) {
    return "customer";
  }
  if (pathname.startsWith("/dashboard")) {
    const mod = moduleForPath(pathname);
    if (mod === "account" || mod === "fortune") return "customer";
    return "staff";
  }
  if (pathname.startsWith("/api/")) {
    const rule = matchApiRule(pathname);
    if (rule?.kind === "module" && (rule.module === "account" || rule.module === "fortune")) {
      return "customer";
    }
  }
  return "staff";
}

function safeDashboardNext(rawNext: string | null): string | null {
  if (!rawNext || !rawNext.startsWith("/dashboard") || rawNext.startsWith("//") || rawNext.includes("\\")) {
    return null;
  }
  return rawNext;
}

export function postLoginPath(space: LoginSpace, rawNext: string | null): string {
  const fallback = homePathForSpace(space);
  const next = safeDashboardNext(rawNext);
  if (!next) return fallback;
  const path = next.split("?")[0] || next;
  if (space === "customer" && !roleCanAccessPath("customer", path)) return fallback;
  return next;
}

export function otherLoginPath(space: LoginSpace, rawNext: string | null): string {
  const base = loginPathForSpace(space === "staff" ? "customer" : "staff");
  const next = safeDashboardNext(rawNext);
  if (!next) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}

export function forgotPasswordPath(space: LoginSpace): string {
  return `/forgot-password?space=${space}`;
}

export function sessionCanAccess(session: SessionPayload, pathname: string): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/dashboard")) return roleCanAccessPath(session.role, pathname);
  if (pathname.startsWith("/api/")) {
    const rule = matchApiRule(pathname);
    if (!rule) return false;
    if (rule.kind === "public" || rule.kind === "api-key" || rule.kind === "webhook") return true;
    if (rule.kind === "module") return roleCanAccessModule(session.role, rule.module);
    if (rule.kind === "roles" || rule.kind === "cron-or-roles") return rule.roles.includes(session.role);
    return false;
  }
  return false;
}

/**
 * Staff session wins on any path that role can open, so a shared browser does not
 * apply the customer cookie to staff tools. The customer cookie is used when no
 * staff session can open the path.
 */
export function pickLoginSession(
  pathname: string,
  staff: SessionPayload | null,
  customer: SessionPayload | null,
): SessionPayload | null {
  if (!pathname) return staff ?? customer;
  if (staff && sessionCanAccess(staff, pathname)) return staff;
  if (customer && sessionCanAccess(customer, pathname)) return customer;
  if (loginSpaceForPath(pathname) === "customer") return customer ?? staff;
  return staff ?? customer;
}
