import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { roleCanAccessPath } from "@/lib/auth/permissions";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PAGE_PREFIXES = ["/login", "/signup", "/register", "/widget"];

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/setup",
  "/api/auth/signup",
  "/api/auth/me",
  "/api/public/",
  "/api/v1/",
  "/api/webhooks/",
  "/api/widget/",
  "/api/gold-signals/atas",
  "/api/gold-signals/bookmap",
  "/api/gold-signals/mt5",
];

function isPublicPage(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function isCronApi(pathname: string) {
  return (
    pathname.startsWith("/api/digest/") ||
    pathname.startsWith("/api/email/automation") ||
    pathname.startsWith("/api/finance/automation") ||
    pathname.startsWith("/api/social/publish") ||
    pathname.startsWith("/api/fortune/daily")
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
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && (isPublicApi(pathname) || isCronApi(pathname))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname.startsWith("/dashboard")) {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/dashboard") && !roleCanAccessPath(session.role, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/login", "/signup"],
};
