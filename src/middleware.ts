import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideApiAccess } from "@/lib/auth/api-policy";
import { moduleForPath, roleCanAccessPath } from "@/lib/auth/permissions";
import { bridgeRequestAuthorized, cronRequestAuthorized } from "@/lib/auth/secrets";
import { verifySessionToken, SESSION_COOKIE, publicRequestOrigin } from "@/lib/auth/session";

const PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/signup",
  "/register",
  "/widget",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

function isPublicPage(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
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

  if (isPublicPage(pathname)) {
    if (pathname === "/login") {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      const session = await verifySessionToken(token);
      if (session) {
        return NextResponse.redirect(new URL("/dashboard", publicRequestOrigin(request)));
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

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
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", publicRequestOrigin(request));
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/login", "/signup"],
};
