import { afterEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import {
  bridgeRequestAuthorized,
  cronRequestAuthorized,
  localApiKey,
} from "@/lib/auth/secrets";
import { assertLocalApiAuth, LocalApiAuthError } from "@/lib/local/local-api-auth";

const saved = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  LOCAL_API_KEY: process.env.LOCAL_API_KEY,
};

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("session secret fails closed", () => {
  it("does not sign or verify when AUTH_SECRET is missing, even if CRON_SECRET is set", async () => {
    delete process.env.AUTH_SECRET;
    process.env.CRON_SECRET = "cron-value-not-a-session-key";
    await expect(
      createSessionToken({
        sub: "user-1",
        role: "owner",
        email: "o@example.com",
        name: "O",
      }),
    ).rejects.toThrow(/AUTH_SECRET is not set/);
    expect(await verifySessionToken("header.sig")).toBeNull();
  });

  it("rejects a token after the secret is removed", async () => {
    process.env.AUTH_SECRET = "b".repeat(32);
    const token = await createSessionToken({
      sub: "user-1",
      role: "admin",
      email: "a@example.com",
      name: "A",
    });
    expect(await verifySessionToken(token)).toMatchObject({ role: "admin" });
    delete process.env.AUTH_SECRET;
    expect(await verifySessionToken(token)).toBeNull();
  });
});

describe("cron and bridge secrets fail closed", () => {
  it("rejects cron requests when CRON_SECRET is unset or missing from the request", () => {
    delete process.env.CRON_SECRET;
    expect(cronRequestAuthorized(new Request("http://127.0.0.1:3000/api/digest/daily"))).toBe(false);
    expect(
      cronRequestAuthorized(new Request("http://127.0.0.1:3000/api/digest/daily?secret=")),
    ).toBe(false);

    process.env.CRON_SECRET = "cron-test-value";
    expect(cronRequestAuthorized(new Request("http://127.0.0.1:3000/api/digest/daily"))).toBe(false);
    expect(
      cronRequestAuthorized(new Request("http://127.0.0.1:3000/api/digest/daily?secret=cron-test-value")),
    ).toBe(true);
    expect(
      cronRequestAuthorized(
        new Request("http://127.0.0.1:3000/api/digest/daily", {
          headers: { authorization: "Bearer cron-test-value" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects bridge requests when LOCAL_API_KEY is unset", () => {
    delete process.env.LOCAL_API_KEY;
    expect(localApiKey()).toBeNull();
    const open = new Request("http://127.0.0.1:3000/api/gold-signals/mt5");
    expect(bridgeRequestAuthorized(open)).toBe(false);
    expect(() => assertLocalApiAuth(open)).toThrow(LocalApiAuthError);
    try {
      assertLocalApiAuth(open);
    } catch (error) {
      expect(error).toBeInstanceOf(LocalApiAuthError);
      expect((error as Error).message).toMatch(/LOCAL_API_KEY is not set/);
    }

    process.env.LOCAL_API_KEY = "bridge-test-value";
    expect(bridgeRequestAuthorized(open)).toBe(false);
    const authed = new Request("http://127.0.0.1:3000/api/gold-signals/mt5", {
      headers: { authorization: "Bearer bridge-test-value" },
    });
    expect(bridgeRequestAuthorized(authed)).toBe(true);
    expect(() => assertLocalApiAuth(authed)).not.toThrow();
  });
});
