import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { readEmailToken } from "@/lib/auth/email-token";
import { sendPasswordResetLink, sendVerificationLink } from "@/lib/auth/send-auth-link";
import { confirmPasswordReset, confirmVerification, findUserByEmail, registerCustomer, verifyLogin } from "@/lib/auth/store";
import { isEmailVerified } from "@/lib/auth/verification";

const saved = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  AXPM_AUTH_USERS_PATH: process.env.AXPM_AUTH_USERS_PATH,
  AUTH_MAIL_OUTBOX: process.env.AUTH_MAIL_OUTBOX,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  AUTH_EMAIL_MODE: process.env.AUTH_EMAIL_MODE,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("sign-up verification", () => {
  it("keeps a new account unverified until the email link is used", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "kc-verify-"));
    process.env.AUTH_SECRET = "f".repeat(32);
    process.env.AXPM_AUTH_USERS_PATH = path.join(dir, "users.json");
    process.env.AUTH_MAIL_OUTBOX = path.join(dir, "outbox.json");
    process.env.RESEND_API_KEY = "mock";
    process.env.AUTH_EMAIL_MODE = "mock";
    delete process.env.EMAIL_FROM;

    try {
      const user = await registerCustomer({
        email: "new@example.com",
        name: "New",
        password: "password-123",
      });
      expect(await sendVerificationLink(user.id, false)).toBe(true);
      const stored = await findUserByEmail("new@example.com");
      expect(stored && isEmailVerified(stored)).toBe(false);
      expect(await verifyLogin("new@example.com", "password-123")).toBeTruthy();
      expect(isEmailVerified((await findUserByEmail("new@example.com"))!)).toBe(false);

      const outbox = JSON.parse(await readFile(process.env.AUTH_MAIL_OUTBOX, "utf8")) as Array<{
        subject: string;
        text: string;
        html: string;
      }>;
      expect(outbox[0]?.subject).toContain("Kayden Chiew");
      expect(`${outbox[0]?.subject}\n${outbox[0]?.text}\n${outbox[0]?.html}`).not.toMatch(/axpm/i);
      const link = outbox[0]?.text.match(/https?:\/\/\S+/)?.[0];
      const token = new URL(link ?? "").searchParams.get("token");
      const claims = await readEmailToken(token);
      expect(claims?.purpose).toBe("verify-email");
      expect(await confirmVerification(claims!.sub, claims!.nonce)).toBe(true);
      expect(isEmailVerified((await findUserByEmail("new@example.com"))!)).toBe(true);
      expect(await confirmVerification(claims!.sub, claims!.nonce)).toBe(false);

      expect(await sendPasswordResetLink("new@example.com")).toBe(true);
      const resetBox = JSON.parse(await readFile(process.env.AUTH_MAIL_OUTBOX, "utf8")) as Array<{ text: string }>;
      const resetLink = resetBox[1]?.text.match(/https?:\/\/\S+/)?.[0];
      const resetToken = new URL(resetLink ?? "").searchParams.get("token");
      const resetClaims = await readEmailToken(resetToken);
      expect(await confirmPasswordReset(resetClaims!.sub, resetClaims!.nonce, "password-456")).toBe(true);
      expect(await verifyLogin("new@example.com", "password-123")).toBeNull();
      expect(await verifyLogin("new@example.com", "password-456")).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
