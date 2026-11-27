import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeGoogleSignIn } from "@/lib/auth/google-account";
import { handleGoogleSignIn } from "@/lib/auth/google-handler";
import { showGoogleSignIn } from "@/lib/auth/google-policy";
import { createOwnerAccount, findUserByEmail, listUsers, registerCustomer } from "@/lib/auth/store";
import { verifyPassword } from "@/lib/auth/password";
import { profileFromTokenInfo } from "@/lib/auth/google-token";
import type { GoogleProfile } from "@/lib/auth/google-token";

const CLIENT_ID = "test-client.apps.googleusercontent.com";

function profile(overrides: Partial<GoogleProfile> = {}): GoogleProfile {
  return {
    sub: "google-sub-1",
    email: "ada@example.com",
    emailVerified: true,
    name: "Ada Lovelace",
    ...overrides,
  };
}

describe("Google button visibility", () => {
  const configured = {
    clientId: CLIENT_ID,
    clientSecretConfigured: true,
  };

  it("hides Google for mainland China and on staff login", () => {
    expect(showGoogleSignIn({ audience: "customer", country: "CN", ...configured })).toBe(false);
    expect(showGoogleSignIn({ audience: "customer", country: "cn", ...configured })).toBe(false);
    expect(showGoogleSignIn({ audience: "staff", country: "US", ...configured })).toBe(false);
    expect(showGoogleSignIn({ audience: "staff", country: null, ...configured })).toBe(false);
  });

  it("shows Google for customers outside mainland China, including an unknown country", () => {
    expect(showGoogleSignIn({ audience: "customer", country: "US", ...configured })).toBe(true);
    expect(showGoogleSignIn({ audience: "customer", country: "HK", ...configured })).toBe(true);
    expect(showGoogleSignIn({ audience: "customer", country: null, ...configured })).toBe(true);
    expect(showGoogleSignIn({ audience: "customer", country: undefined, ...configured })).toBe(true);
  });

  it("hides Google when the client id or secret is unset", () => {
    expect(
      showGoogleSignIn({
        audience: "customer",
        country: "US",
        clientId: "",
        clientSecretConfigured: true,
      }),
    ).toBe(false);
    expect(
      showGoogleSignIn({
        audience: "customer",
        country: "US",
        clientId: CLIENT_ID,
        clientSecretConfigured: false,
      }),
    ).toBe(false);
  });
});

describe("Google account linking", () => {
  beforeEach(async () => {
    vi.spyOn(process, "cwd").mockReturnValue(mkdtempSync(path.join(tmpdir(), "gauth-")));
    await createOwnerAccount({
      email: "owner@example.com",
      name: "Owner",
      password: "owner-password",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("signs a Google email into the existing password user and does not create a second user", async () => {
    const existing = await registerCustomer({
      email: "ada@example.com",
      name: "Ada",
      password: "correct-horse",
    });
    const before = (await listUsers()).find((user) => user.id === existing.id);
    expect(before?.password_hash).toBeTruthy();

    const result = await completeGoogleSignIn(
      profile({ email: "Ada@Example.com", name: "Different Name", sub: "sub-ada" }),
      "US",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(false);
    expect(result.user.id).toBe(existing.id);
    expect(result.user.role).toBe("customer");
    expect(result.user.email).toBe("ada@example.com");

    const users = await listUsers();
    expect(users.filter((user) => user.email === "ada@example.com")).toHaveLength(1);
    const after = users.find((user) => user.id === existing.id);
    expect(after?.password_hash).toBe(before?.password_hash);
    expect(after?.role).toBe("customer");
    expect(verifyPassword("correct-horse", after?.password_hash ?? "")).toBe(true);
    expect(after?.google_sub).toBe("sub-ada");
    expect(after?.name).toBe("Ada");
  });

  it("creates a new Google user as a customer, not staff", async () => {
    const result = await completeGoogleSignIn(profile({ email: "new@example.com", sub: "sub-new" }), null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.user.role).toBe("customer");
    expect(result.user.role).not.toBe("owner");
    expect(["admin", "sales", "finance", "personal", "viewer"]).not.toContain(result.user.role);

    const record = await findUserByEmail("new@example.com");
    expect(record?.role).toBe("customer");
    expect(verifyPassword("password", record?.password_hash ?? "")).toBe(false);

    const again = await completeGoogleSignIn(profile({ email: "new@example.com", sub: "sub-new" }), "DE");
    expect(again.ok && again.created).toBe(false);
    if (again.ok) expect(again.user.id).toBe(result.user.id);
    expect((await listUsers()).filter((user) => user.email === "new@example.com")).toHaveLength(1);
  });

  it("does not create a user for a mainland China request", async () => {
    const before = (await listUsers()).length;
    const result = await completeGoogleSignIn(profile({ email: "cn@example.com" }), "CN");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(await listUsers()).toHaveLength(before);
    expect(await findUserByEmail("cn@example.com")).toBeNull();
  });
});

describe("Google sign-in request", () => {
  const saved = {
    id: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
  };

  beforeEach(() => {
    vi.spyOn(process, "cwd").mockReturnValue(mkdtempSync(path.join(tmpdir(), "gauth-http-")));
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (saved.id === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = saved.id;
    if (saved.secret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = saved.secret;
  });

  it("rejects mainland China before calling Google or writing a user", async () => {
    const fetchImpl = vi.fn();
    const res = await handleGoogleSignIn(
      new Request("http://127.0.0.1/api/auth/google", {
        method: "POST",
        headers: { "cf-ipcountry": "CN", "content-type": "application/json" },
        body: JSON.stringify({ credential: "header.payload.sig" }),
      }),
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await listUsers()).toHaveLength(0);
  });

  it("stays unavailable when Google env is unset", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    const fetchImpl = vi.fn();
    const res = await handleGoogleSignIn(
      new Request("http://127.0.0.1/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "auth-code" }),
      }),
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.body.error).toBe("Google sign-in is unavailable");
  });
});

describe("Google token checks", () => {
  const future = Math.floor(Date.now() / 1000) + 3600;

  it("accepts a verified token for this client id", () => {
    expect(
      profileFromTokenInfo(
        {
          aud: CLIENT_ID,
          iss: "https://accounts.google.com",
          sub: "sub-1",
          email: "ada@example.com",
          email_verified: "true",
          name: "Ada",
          exp: future,
        },
        CLIENT_ID,
      ),
    ).toMatchObject({ email: "ada@example.com", sub: "sub-1", emailVerified: true });
  });

  it("rejects a token for another client, an unverified email, or a bad issuer", () => {
    const base = {
      aud: CLIENT_ID,
      iss: "https://accounts.google.com",
      sub: "sub-1",
      email: "ada@example.com",
      email_verified: "true" as const,
      exp: future,
    };
    expect(profileFromTokenInfo({ ...base, aud: "other-client" }, CLIENT_ID)).toBeNull();
    expect(profileFromTokenInfo({ ...base, email_verified: "false" }, CLIENT_ID)).toBeNull();
    expect(profileFromTokenInfo({ ...base, iss: "https://evil.example" }, CLIENT_ID)).toBeNull();
    expect(profileFromTokenInfo({ ...base, exp: 1 }, CLIENT_ID)).toBeNull();
  });
});
