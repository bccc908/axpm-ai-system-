import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { decideApiAccess } from "@/lib/auth/api-policy";
import { middleware } from "@/middleware";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const previous = process.env.AUTH_SECRET;

afterEach(() => {
  if (previous === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previous;
});

describe("CRM stays off the public role", () => {
  it("returns 403 for a customer on CRM pages and CRM export, and lets staff through", async () => {
    process.env.AUTH_SECRET = "e".repeat(32);
    const customer = await createSessionToken({
      sub: "customer-1",
      role: "customer",
      email: "c@example.com",
      name: "C",
    });
    const admin = await createSessionToken({
      sub: "admin-1",
      role: "admin",
      email: "a@example.com",
      name: "A",
    });
    const sales = await createSessionToken({
      sub: "sales-1",
      role: "sales",
      email: "s@example.com",
      name: "S",
    });

    for (const path of ["/dashboard/crm", "/dashboard/crm/leads/1", "/dashboard/clients"]) {
      const denied = await middleware(
        new NextRequest(`http://127.0.0.1:3000${path}`, {
          headers: { cookie: `${SESSION_COOKIE}=${customer}` },
        }),
      );
      expect(denied.status, path).toBe(403);
    }

    const adminPage = await middleware(
      new NextRequest("http://127.0.0.1:3000/dashboard/crm", {
        headers: { cookie: `${SESSION_COOKIE}=${admin}` },
      }),
    );
    expect(adminPage.status).toBe(200);

    const salesPage = await middleware(
      new NextRequest("http://127.0.0.1:3000/dashboard/clients", {
        headers: { cookie: `${SESSION_COOKIE}=${sales}` },
      }),
    );
    expect(salesPage.status).toBe(200);

    expect(decideApiAccess({
      pathname: "/api/crm/export",
      role: "customer",
      cronAuthorized: false,
      bridgeAuthorized: false,
    })).toMatchObject({ allow: false, status: 403 });
    expect(decideApiAccess({
      pathname: "/api/crm/export",
      role: "admin",
      cronAuthorized: false,
      bridgeAuthorized: false,
    }).allow).toBe(true);
    expect(decideApiAccess({
      pathname: "/api/auth/verify-email",
      role: null,
      cronAuthorized: false,
      bridgeAuthorized: false,
    }).allow).toBe(true);
  });
});
