import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideApiAccess } from "@/lib/auth/api-policy";
import {
  CUSTOMER_LOGIN_PATH,
  STAFF_LOGIN_PATH,
  homePathForSpace,
  loginPathForSpace,
  loginSpaceForPath,
  pickLoginSession,
} from "@/lib/auth/login-space";
import { readLoginSessions } from "@/lib/auth/login-sessions";
import { moduleForPath, roleCanAccessPath } from "@/lib/auth/permissions";
import { bridgeRequestAuthorized, cronRequestAuthorized } from "@/lib/auth/secrets";
import { publicRequestOrigin } from "@/lib/auth/session";

const PUBLIC_PAGE_PREFIXES = [
  STAFF_LOGIN_PATH,
  CUSTOMER_LOGIN_PATH,
  "/signup",
  "/register",
  "/widget",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

function isPublicPage(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function nextWithPath(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-kc-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  const sessions = await readLoginSessions((name) => request.cookies.get(name)?.value);

  if (isPublicPage(pathname)) {
    if (pathname === STAFF_LOGIN_PATH && sessions.staff) {
      return NextResponse.redirect(new URL(homePathForSpace("staff"), publicRequestOrigin(request)));
    }
    if (pathname === CUSTOMER_LOGIN_PATH && sessions.customer) {
      return NextResponse.redirect(new URL(homePathForSpace("customer"), publicRequestOrigin(request)));
    }
    return NextResponse.next();
  }

  const session = pickLoginSession(pathname, sessions.staff, sessions.customer);

  if (pathname.startsWith("/api/")) {
    const decision = decideApiAccess({
      pathname,
      role: session?.role ?? null,
      cronAuthorized: cronRequestAuthorized(request),
      bridgeAuthorized: bridgeRequestAuthorized(request),
    });
    if (!decision.allow) {
      return NextResponse.json({ error: decision.error }, { status: decision.status });
    }
    return nextWithPath(request);
  }

  if (!session) {
    const loginUrl = new URL(loginPathForSpace(loginSpaceForPath(pathname)), publicRequestOrigin(request));
    if (pathname.startsWith("/dashboard")) {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/dashboard") && !roleCanAccessPath(session.role, pathname)) {
    if (moduleForPath(pathname) === "crm") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", publicRequestOrigin(request)));
  }

  return nextWithPath(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/login", "/customer/login", "/signup"],
};
