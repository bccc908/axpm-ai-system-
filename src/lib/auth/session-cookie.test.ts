import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "@/lib/auth/session";

describe("session cookie", () => {
  it("is host-only, Secure on HTTPS, and SameSite=Lax", () => {
    const https = sessionCookieOptions(60, {
      url: "https://app.kaydenchiew.com/api/auth/login",
      headers: new Headers({ "x-forwarded-proto": "https" }),
    });
    expect(https.secure).toBe(true);
    expect(https.sameSite).toBe("lax");
    expect(https.httpOnly).toBe(true);
    expect(https).not.toHaveProperty("domain");

    const http = sessionCookieOptions(60, {
      url: "http://127.0.0.1:3000/api/auth/login",
      headers: new Headers(),
    });
    expect(http.secure).toBe(false);
    expect(http.sameSite).toBe("lax");
    expect(http).not.toHaveProperty("domain");
  });
});
