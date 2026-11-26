import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { registerCustomer } from "@/lib/auth/store";
import { isEmailVerified } from "@/lib/auth/verification";

const previous = process.env.AXPM_AUTH_USERS_PATH;

afterEach(() => {
  if (previous === undefined) delete process.env.AXPM_AUTH_USERS_PATH;
  else process.env.AXPM_AUTH_USERS_PATH = previous;
});

describe("users file lock", () => {
  it("keeps both rows when two sign-ups write at the same time", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "kc-users-"));
    const file = path.join(dir, "users.json");
    process.env.AXPM_AUTH_USERS_PATH = file;
    try {
      await Promise.all([
        registerCustomer({ email: "one@example.com", name: "One", password: "password-123" }),
        registerCustomer({ email: "two@example.com", name: "Two", password: "password-123" }),
      ]);
      const stored = JSON.parse(await readFile(file, "utf8")) as {
        users: Array<{ email: string; email_verified_at?: string | null; role: string }>;
      };
      expect(stored.users.map((user) => user.email).sort()).toEqual([
        "one@example.com",
        "two@example.com",
      ]);
      expect(stored.users.every((user) => user.role === "customer")).toBe(true);
      expect(stored.users.every((user) => !isEmailVerified(user))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
