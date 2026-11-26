import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { registerCustomer } from "@/lib/auth/store";
import { PUBLIC_SIGNUP_ROLE } from "@/lib/auth/types";

const previous = process.env.AXPM_AUTH_USERS_PATH;

afterEach(() => {
  if (previous === undefined) delete process.env.AXPM_AUTH_USERS_PATH;
  else process.env.AXPM_AUTH_USERS_PATH = previous;
});

describe("public sign-up role", () => {
  it("creates a customer even if the caller tries to pass another role", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "axpm-auth-"));
    process.env.AXPM_AUTH_USERS_PATH = path.join(dir, "users.json");

    const user = await registerCustomer({
      email: "new-user@example.com",
      name: "New User",
      password: "password-123",
      ...({ role: "owner" } as object),
    });

    expect(PUBLIC_SIGNUP_ROLE).toBe("customer");
    expect(user.role).toBe("customer");
    const stored = JSON.parse(await fs.readFile(process.env.AXPM_AUTH_USERS_PATH, "utf-8")) as {
      users: Array<{ role: string; email: string }>;
    };
    expect(stored.users).toHaveLength(1);
    expect(stored.users[0]?.role).toBe("customer");
    expect(stored.users[0]?.email).toBe("new-user@example.com");
  });
});
