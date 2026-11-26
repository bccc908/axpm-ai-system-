import { randomBytes } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { jar } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      if (!value) jar.delete(name);
      else jar.set(name, value);
    },
  }),
  headers: async () => new Headers(),
}));

import { POST as customerLogin } from "@/app/api/auth/customer-login/route";
import { POST as staffLogin } from "@/app/api/auth/login/route";
import { clearRateLimits } from "@/lib/auth/rate-limit";
import { verifySessionToken } from "@/lib/auth/session";
import { confirmVerification, createUser, findUserByEmail, registerCustomer } from "@/lib/auth/store";
import { CUSTOMER_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth/types";

const saved = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  AXPM_AUTH_USERS_PATH: process.env.AXPM_AUTH_USERS_PATH,
};

let dir = "";
let password = "";

function post(url: string, email: string, secret: string) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: secret }),
  });
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "kc-login-"));
  password = `pw-${randomBytes(9).toString("hex")}`;
  process.env.AUTH_SECRET = "d".repeat(32);
  process.env.AXPM_AUTH_USERS_PATH = path.join(dir, "users.json");
  jar.clear();
  clearRateLimits();

  await createUser({
    email: "owner@example.com",
    name: "Owner",
    password,
    role: "owner",
  });
  await createUser({
    email: "sales@example.com",
    name: "Sales",
    password,
    role: "sales",
  });
  const customer = await registerCustomer({
    email: "customer@example.com",
    name: "Customer",
    password,
  });
  const stored = await findUserByEmail(customer.email);
  await confirmVerification(stored!.id, stored!.verify_nonce!);
  await registerCustomer({
    email: "pending@example.com",
    name: "Pending",
    password,
  });
});

afterEach(async () => {
  jar.clear();
  clearRateLimits();
  if (saved.AUTH_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = saved.AUTH_SECRET;
  if (saved.AXPM_AUTH_USERS_PATH === undefined) delete process.env.AXPM_AUTH_USERS_PATH;
  else process.env.AXPM_AUTH_USERS_PATH = saved.AXPM_AUTH_USERS_PATH;
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("staff and customer logins reject each other's credentials", () => {
  it("does not accept a customer on the staff login, or staff on the customer login", async () => {
    const customerOnStaff = await staffLogin(
      post("http://127.0.0.1:3000/api/auth/login", "customer@example.com", password),
    );
    const ownerOnCustomer = await customerLogin(
      post("http://127.0.0.1:3000/api/auth/customer-login", "owner@example.com", password),
    );
    const salesOnCustomer = await customerLogin(
      post("http://127.0.0.1:3000/api/auth/customer-login", "sales@example.com", password),
    );
    const badPassword = await staffLogin(
      post("http://127.0.0.1:3000/api/auth/login", "owner@example.com", `${password}-no`),
    );

    expect(customerOnStaff.status).toBe(401);
    expect(ownerOnCustomer.status).toBe(401);
    expect(salesOnCustomer.status).toBe(401);
    expect(await customerOnStaff.json()).toEqual({ error: "Invalid email or password" });
    expect(await ownerOnCustomer.json()).toEqual(await badPassword.json());
    expect(jar.size).toBe(0);
  });

  it("signs the matching account into that space's cookie only", async () => {
    const staff = await staffLogin(post("http://127.0.0.1:3000/api/auth/login", "owner@example.com", password));
    expect(staff.status).toBe(200);
    const staffToken = jar.get(SESSION_COOKIE);
    expect(staffToken).toBeTruthy();
    expect(jar.has(CUSTOMER_SESSION_COOKIE)).toBe(false);
    expect(await verifySessionToken(staffToken)).toMatchObject({ role: "owner", space: "staff" });

    jar.clear();
    const customer = await customerLogin(
      post("http://127.0.0.1:3000/api/auth/customer-login", "customer@example.com", password),
    );
    expect(customer.status).toBe(200);
    const customerToken = jar.get(CUSTOMER_SESSION_COOKIE);
    expect(customerToken).toBeTruthy();
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await verifySessionToken(customerToken)).toMatchObject({ role: "customer", space: "customer" });
  });

  it("still requires email verification on the customer login", async () => {
    const pendingOnCustomer = await customerLogin(
      post("http://127.0.0.1:3000/api/auth/customer-login", "pending@example.com", password),
    );
    const pendingOnStaff = await staffLogin(
      post("http://127.0.0.1:3000/api/auth/login", "pending@example.com", password),
    );

    expect(pendingOnCustomer.status).toBe(403);
    expect(await pendingOnCustomer.json()).toMatchObject({ code: "email_unverified" });
    expect(pendingOnStaff.status).toBe(401);
    expect(await pendingOnStaff.json()).toEqual({ error: "Invalid email or password" });
    expect(jar.size).toBe(0);
  });
});
