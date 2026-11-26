import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimits } from "@/lib/auth/rate-limit";

afterEach(() => {
  clearRateLimits();
});

describe("auth rate limits", () => {
  it("limits signup by email and by IP separately", () => {
    const request = new Request("http://127.0.0.1/api/auth/signup", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    expect(checkRateLimit(request, "signup", "a@example.com").ok).toBe(true);
    expect(checkRateLimit(request, "signup", "a@example.com").ok).toBe(true);
    expect(checkRateLimit(request, "signup", "a@example.com").ok).toBe(true);
    const blocked = checkRateLimit(request, "signup", "a@example.com");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);

    expect(checkRateLimit(request, "signup", "b@example.com").ok).toBe(true);
    const otherIp = new Request("http://127.0.0.1/api/auth/signup", {
      headers: { "x-forwarded-for": "203.0.113.11" },
    });
    expect(checkRateLimit(otherIp, "login", "a@example.com").ok).toBe(true);
  });
});
