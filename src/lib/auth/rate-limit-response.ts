import { NextResponse } from "next/server";
import { checkRateLimit, type RateLimitAction } from "@/lib/auth/rate-limit";

export function rateLimitResponse(request: Request, action: RateLimitAction, email?: string) {
  const result = checkRateLimit(request, action, email);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}
