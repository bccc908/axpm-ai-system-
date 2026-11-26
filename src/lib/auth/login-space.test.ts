import { readFileSync } from "fs";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { LoginCrossLinks } from "@/components/auth/login-form";
import { en } from "@/lib/i18n/locales/en";
import { zh } from "@/lib/i18n/locales/zh";
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_LOGIN_PATH,
  STAFF_HOME_PATH,
  STAFF_LOGIN_PATH,
  loginSpaceForPath,
  loginSpaceForRole,
  otherLoginPath,
  postLoginPath,
} from "@/lib/auth/login-space";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { CUSTOMER_SESSION_COOKIE, SESSION_COOKIE, type UserRole } from "@/lib/auth/types";
import { middleware } from "@/middleware";

const root = process.cwd();
const previousSecret = process.env.AUTH_SECRET;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousSecret;
});

const STAFF_ROLES: UserRole[] = ["owner", "admin", "sales", "finance", "personal", "viewer"];

describe("login spaces", () => {
  it("keeps every staff role out of the customer space", () => {
    for (const role of STAFF_ROLES) {
      expect(loginSpaceForRole(role), role).toBe("staff");
    }
    expect(loginSpaceForRole("customer")).toBe("customer");
  });

  it("sends customers home to their account and staff home to the dashboard", () => {
    expect(postLoginPath("staff", null)).toBe(STAFF_HOME_PATH);
    expect(postLoginPath("customer", null)).toBe(CUSTOMER_HOME_PATH);
    expect(postLoginPath("customer", "/dashboard/crm")).toBe(CUSTOMER_HOME_PATH);
    expect(postLoginPath("customer", "/dashboard/fortune")).toBe("/dashboard/fortune");
    expect(postLoginPath("staff", "/dashboard/crm")).toBe("/dashboard/crm");
    expect(postLoginPath("staff", "https://example.com")).toBe(STAFF_HOME_PATH);
  });

  it("points each login page at the other, and keeps a safe return path", () => {
    expect(otherLoginPath("staff", null)).toBe(CUSTOMER_LOGIN_PATH);
    expect(otherLoginPath("customer", null)).toBe(STAFF_LOGIN_PATH);
    expect(otherLoginPath("staff", "/dashboard/fortune")).toBe(
      "/customer/login?next=%2Fdashboard%2Ffortune",
    );
    expect(loginSpaceForPath("/dashboard/account")).toBe("customer");
    expect(loginSpaceForPath("/dashboard/fortune")).toBe("customer");
    expect(loginSpaceForPath("/dashboard/crm")).toBe("staff");
    expect(loginSpaceForPath("/dashboard")).toBe("staff");
  });

  it("rejects a session whose space claim disagrees with the role", async () => {
    process.env.AUTH_SECRET = "b".repeat(32);
    const mismatched = await createSessionToken({
      sub: "admin-1",
      role: "admin",
      email: "a@example.com",
      name: "A",
      space: "customer",
    });
    expect(await verifySessionToken(mismatched)).toBeNull();
  });
});

describe("login pages", () => {
  it("links each page to the other login", () => {
    const staff = renderToStaticMarkup(
      createElement(LoginCrossLinks, {
        space: "staff",
        nextPath: null,
        note: en.auth.customerNote,
        otherLabel: en.auth.customerLink,
        signupLabel: en.auth.signupLink,
      }),
    );
    const customer = renderToStaticMarkup(
      createElement(LoginCrossLinks, {
        space: "customer",
        nextPath: null,
        note: en.auth.staffLoginNote,
        otherLabel: en.auth.staffLoginLink,
        signupLabel: en.auth.signupLink,
      }),
    );

    expect(staff).toContain('href="/customer/login"');
    expect(staff).toContain(en.auth.customerLink);
    expect(customer).toContain('href="/login"');
    expect(customer).not.toContain('href="/customer/login"');
    expect(customer).toContain(en.auth.staffLoginLink);

    const staffPage = readFileSync(path.join(root, "src/app/login/page.tsx"), "utf8");
    const customerPage = readFileSync(path.join(root, "src/app/customer/login/page.tsx"), "utf8");
    const form = readFileSync(path.join(root, "src/components/auth/login-form.tsx"), "utf8");
    expect(staffPage).toContain('space="staff"');
    expect(customerPage).toContain('space="customer"');
    expect(form).toContain("<LoginCrossLinks");
    expect(form).toContain('"/api/auth/login"');
    expect(form).toContain('"/api/auth/customer-login"');
    expect(`${staffPage}\n${customerPage}\n${form}`).not.toMatch(/axpm/i);
  });

  it("labels the two pages differently in English and Chinese", () => {
    const zhAuth = (zh as unknown as { auth: Record<string, string> }).auth;
    expect(en.auth.loginTitle).toMatch(/Staff/i);
    expect(en.auth.customerLoginTitle).toMatch(/Customer/i);
    expect(en.auth.loginTitle).not.toBe(en.auth.customerLoginTitle);
    expect(zhAuth.loginTitle).toContain("员工");
    expect(zhAuth.customerLoginTitle).toContain("客户");
    expect(zhAuth.loginTitle).not.toBe(zhAuth.customerLoginTitle);
    expect(en.auth.invalidCredentials).toBe("Invalid email or password");
    expect(`${en.auth.loginTitle} ${en.auth.customerLoginTitle} ${zhAuth.loginTitle}`).not.toMatch(/axpm/i);
  });
});

describe("login middleware isolation", () => {
  it("rejects the wrong cookie and sends logged-out visitors to the matching login", async () => {
    process.env.AUTH_SECRET = "c".repeat(32);
    const staff = await createSessionToken({
      sub: "owner-1",
      role: "owner",
      email: "owner@example.com",
      name: "Owner",
      space: "staff",
    });
    const customer = await createSessionToken({
      sub: "customer-1",
      role: "customer",
      email: "customer@example.com",
      name: "Customer",
      space: "customer",
    });

    const account = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/account"));
    expect(account.status).toBe(307);
    expect(account.headers.get("location")).toContain("/customer/login?next=%2Fdashboard%2Faccount");

    const crm = await middleware(new NextRequest("http://127.0.0.1:3000/dashboard/crm"));
    expect(crm.status).toBe(307);
    expect(crm.headers.get("location")).toContain("/login?next=%2Fdashboard%2Fcrm");
    expect(crm.headers.get("location")).not.toContain("/customer/login");

    const staffOnCustomerPage = await middleware(
      new NextRequest("http://127.0.0.1:3000/customer/login", {
        headers: { cookie: `${SESSION_COOKIE}=${staff}` },
      }),
    );
    expect(staffOnCustomerPage.status).toBe(200);

    const customerOnStaffPage = await middleware(
      new NextRequest("http://127.0.0.1:3000/login", {
        headers: { cookie: `${CUSTOMER_SESSION_COOKIE}=${customer}` },
      }),
    );
    expect(customerOnStaffPage.status).toBe(200);

    const staffHome = await middleware(
      new NextRequest("http://127.0.0.1:3000/login", {
        headers: { cookie: `${SESSION_COOKIE}=${staff}` },
      }),
    );
    expect(staffHome.status).toBe(307);
    expect(staffHome.headers.get("location")).toContain("/dashboard");

    const customerHome = await middleware(
      new NextRequest("http://127.0.0.1:3000/customer/login", {
        headers: { cookie: `${CUSTOMER_SESSION_COOKIE}=${customer}` },
      }),
    );
    expect(customerHome.status).toBe(307);
    expect(customerHome.headers.get("location")).toContain("/dashboard/account");

    const customerCrm = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/crm/export", {
        headers: { cookie: `${CUSTOMER_SESSION_COOKIE}=${customer}` },
      }),
    );
    expect(customerCrm.status).toBe(403);

    const staffInCustomerCookie = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/crm/export", {
        headers: { cookie: `${CUSTOMER_SESSION_COOKIE}=${staff}` },
      }),
    );
    expect(staffInCustomerCookie.status).toBe(401);

    const customerFortune = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/fortune/readings", {
        headers: { cookie: `${CUSTOMER_SESSION_COOKIE}=${customer}` },
      }),
    );
    expect(customerFortune.status).toBe(200);

    const staffCrm = await middleware(
      new NextRequest("http://127.0.0.1:3000/dashboard/crm", {
        headers: { cookie: `${SESSION_COOKIE}=${staff}` },
      }),
    );
    expect(staffCrm.status).toBe(200);
  });
});
