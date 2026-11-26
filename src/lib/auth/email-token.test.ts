import { afterEach, describe, expect, it } from "vitest";
import { createEmailToken, readEmailToken } from "@/lib/auth/email-token";

const previous = process.env.AUTH_SECRET;

afterEach(() => {
  if (previous === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previous;
});

describe("email tokens", () => {
  it("signs a token that expires and rejects a bad signature", async () => {
    process.env.AUTH_SECRET = "c".repeat(32);
    const token = await createEmailToken({
      sub: "user-1",
      purpose: "verify-email",
      nonce: "nonce-1",
    });
    const claims = await readEmailToken(token);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.purpose).toBe("verify-email");
    expect(claims?.nonce).toBe("nonce-1");

    const [body, sig] = token.split(".");
    expect(await readEmailToken(`${body}.${sig}x`)).toBeNull();
    expect(await readEmailToken("not-a-token")).toBeNull();

    const expiredBody = Buffer.from(
      JSON.stringify({ sub: "user-1", purpose: "reset-password", nonce: "n", exp: 1 }),
    ).toString("base64url");
    expect(await readEmailToken(`${expiredBody}.${sig}`)).toBeNull();
  });

  it("does not verify when AUTH_SECRET is missing", async () => {
    process.env.AUTH_SECRET = "d".repeat(32);
    const token = await createEmailToken({ sub: "user-1", purpose: "reset-password", nonce: "n" });
    delete process.env.AUTH_SECRET;
    expect(await readEmailToken(token)).toBeNull();
  });
});
