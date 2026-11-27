import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/locales/en";
import { zh } from "@/lib/i18n/locales/zh";
import { decideApiAccess } from "@/lib/auth/api-policy";
import { middleware } from "@/middleware";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";
import { isEmailVerified } from "@/lib/auth/verification";
import {
  buildProductSignupList,
  canViewProductSignups,
  emailVerifiedFromField,
  formatInKualaLumpur,
  isProductSignupsPath,
  productSignupsForbiddenHtml,
  withoutAxpmBrand,
  type ProductSignupUser,
} from "@/lib/customers/product-signups";

const sessionBox = vi.hoisted(() => ({
  current: null as null | {
    user: { id: string; email: string; name: string; role: UserRole };
    session: { sub: string; role: UserRole; email: string; name: string; exp: number };
  },
}));

vi.mock("@/lib/auth/api-session", () => ({
  getServerSession: vi.fn(async () => sessionBox.current),
}));

import { GET } from "@/app/api/staff/product-signups/route";

const NOW = new Date("2026-11-27T04:00:00.000Z");
const FIXTURE_SECRET = "fixture-hash-not-a-password";
const FIXTURE_KEY = "sk-fixture-not-a-key";
const VERIFIED_AT = "2026-11-27T03:20:00.000Z";

const previous = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  AXPM_AUTH_USERS_PATH: process.env.AXPM_AUTH_USERS_PATH,
  AXPM_CUSTOMER_ACCOUNTS_PATH: process.env.AXPM_CUSTOMER_ACCOUNTS_PATH,
};

afterEach(() => {
  restore("AUTH_SECRET", previous.AUTH_SECRET);
  restore("AXPM_AUTH_USERS_PATH", previous.AXPM_AUTH_USERS_PATH);
  restore("AXPM_CUSTOMER_ACCOUNTS_PATH", previous.AXPM_CUSTOMER_ACCOUNTS_PATH);
  sessionBox.current = null;
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function user(partial: Partial<ProductSignupUser> & Pick<ProductSignupUser, "id" | "role">): ProductSignupUser {
  return {
    email: `${partial.id}@example.com`,
    name: partial.id,
    is_active: true,
    created_at: NOW.toISOString(),
    password_hash: FIXTURE_SECRET,
    ...partial,
  };
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") {
    for (const nested of Object.values(value)) collectStrings(nested, out);
  }
  return out;
}

describe("product sign-up list", () => {
  it("lists only customer sign-ups, newest first, with plan and status when stored", () => {
    const list = buildProductSignupList(
      [
        user({
          id: "owner-1",
          role: "owner",
          email: "owner.fixture@example.com",
          name: "Owner Fixture",
          created_at: "2026-11-27T03:30:00.000Z",
          email_verified_at: "2026-01-02T00:00:00.000Z",
        }),
        user({
          id: "signup-new",
          role: "customer",
          name: "Verified Customer",
          email: "verified.customer@example.com",
          created_at: "2026-11-27T03:00:00.000Z",
          email_verified_at: VERIFIED_AT,
        }),
        user({
          id: "signup-week",
          role: "customer",
          name: "Week Signup",
          email: "week.signup@example.com",
          created_at: "2026-11-25T04:00:00.000Z",
          email_verified_at: null,
        }),
        user({
          id: "signup-old",
          role: "customer",
          name: "Unverified Customer",
          email: "unverified.customer@example.com",
          is_active: false,
          created_at: "2026-11-01T00:00:00.000Z",
          email_verified_at: null,
        }),
        user({ id: "sales-1", role: "sales", email: "sales.fixture@example.com", created_at: "2026-11-27T03:59:00.000Z" }),
      ],
      [
        { user_id: "signup-new", plan: "pro", status: "trialing" },
        { user_id: "signup-old", plan: "free", status: "active" },
      ],
      NOW,
    );

    expect(list.signups.map((row) => row.id)).toEqual(["signup-new", "signup-week", "signup-old"]);
    expect(list.signups[0]).toMatchObject({
      email: "verified.customer@example.com",
      signed_up_at_display: "2026-11-27 11:00",
      email_verified: true,
      email_verified_at: VERIFIED_AT,
      email_verified_at_display: "2026-11-27 11:20",
      plan: "pro",
      account_status: "trialing",
      login_active: true,
    });
    expect(list.signups[1]).toMatchObject({
      plan: null,
      account_status: null,
      email_verified: false,
      email_verified_at: null,
      signed_up_at_display: "2026-11-25 12:00",
    });
    expect(list.signups[2]).toMatchObject({
      email: "unverified.customer@example.com",
      email_verified: false,
      login_active: false,
    });
    expect(list.counts).toEqual({
      all: 3,
      last_24_hours: 1,
      last_7_days: 2,
      active: 2,
      verified: 1,
      not_verified: 2,
    });
    expect(list.as_of_display).toBe("2026-11-27 12:00");
    expect(list.timezone).toBe("Asia/Kuala_Lumpur");

    const serialized = JSON.stringify(list);
    expect(serialized).not.toContain(FIXTURE_SECRET);
    expect(serialized).not.toContain(FIXTURE_KEY);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("not_built");
    expect(serialized).not.toContain("owner.fixture@example.com");
    expect(serialized).not.toContain("sales.fixture@example.com");
  });

  it("reads verified and not verified from email_verified_at and does not invent one state", () => {
    expect(emailVerifiedFromField(VERIFIED_AT)).toEqual({
      email_verified: true,
      email_verified_at: VERIFIED_AT,
      email_verified_at_display: "2026-11-27 11:20",
    });
    expect(emailVerifiedFromField(null)).toMatchObject({ email_verified: false, email_verified_at: null });
    expect(emailVerifiedFromField(undefined)).toMatchObject({ email_verified: false, email_verified_at: null });
    expect(emailVerifiedFromField("")).toMatchObject({ email_verified: false, email_verified_at: null });
    expect(emailVerifiedFromField("   ")).toMatchObject({ email_verified: false, email_verified_at: null });

    const verified = buildProductSignupList(
      [
        user({
          id: "same",
          role: "customer",
          email: "verified.customer@example.com",
          email_verified_at: VERIFIED_AT,
        }),
      ],
      [],
      NOW,
    );
    const unverified = buildProductSignupList(
      [
        user({
          id: "same",
          role: "customer",
          email: "verified.customer@example.com",
          email_verified_at: null,
        }),
      ],
      [],
      NOW,
    );
    expect(verified.signups[0].email).toBe(unverified.signups[0].email);
    expect(verified.signups[0].email_verified).toBe(true);
    expect(unverified.signups[0].email_verified).toBe(false);
    expect(verified.signups[0].email_verified_at).toBe(VERIFIED_AT);
    expect(unverified.signups[0].email_verified_at).toBeNull();
    expect(verified.counts.verified).toBe(1);
    expect(unverified.counts.not_verified).toBe(1);
  });

  it("does not treat a missing email_verified_at as verified the way login does", () => {
    expect(isEmailVerified({})).toBe(true);
    const list = buildProductSignupList(
      [user({ id: "missing-field", role: "customer", email: "missing.customer@example.com" })],
      [],
      NOW,
    );
    expect(list.signups[0].email_verified).toBe(false);
    expect(list.signups[0].email_verified_at).toBeNull();
    expect(list.signups[0].email_verified_at_display).toBeNull();
  });

  it("keeps an unparseable present value verified without inventing a clock time", () => {
    const list = buildProductSignupList(
      [
        user({
          id: "odd",
          role: "customer",
          email: "odd.customer@example.com",
          email_verified_at: "not-a-timestamp",
        }),
      ],
      [],
      NOW,
    );
    expect(list.signups[0].email_verified).toBe(true);
    expect(list.signups[0].email_verified_at).toBe("not-a-timestamp");
    expect(list.signups[0].email_verified_at_display).toBeNull();
  });

  it("formats midnight in Kuala Lumpur as 00:00 and breaks ties by id", () => {
    expect(formatInKualaLumpur("2026-11-26T16:00:00.000Z")).toBe("2026-11-27 00:00");
    const list = buildProductSignupList(
      [
        user({ id: "b-customer", role: "customer", created_at: "2026-11-26T16:00:00.000Z", email_verified_at: null }),
        user({ id: "a-customer", role: "customer", created_at: "2026-11-26T16:00:00.000Z", email_verified_at: null }),
      ],
      [],
      NOW,
    );
    expect(list.signups.map((row) => row.id)).toEqual(["a-customer", "b-customer"]);
    expect(list.signups.every((row) => row.signed_up_at_display === "2026-11-27 00:00")).toBe(true);
  });

  it("lets CRM staff view the list and refuses customers and other roles", () => {
    const allowed: UserRole[] = ["owner", "admin", "sales", "viewer"];
    const refused: UserRole[] = ["customer", "finance", "personal"];
    for (const role of allowed) expect(canViewProductSignups(role)).toBe(true);
    for (const role of refused) expect(canViewProductSignups(role)).toBe(false);
    expect(isProductSignupsPath("/dashboard/clients")).toBe(true);
    expect(isProductSignupsPath("/dashboard/clients/contact-1")).toBe(false);
    expect(isProductSignupsPath("/dashboard/crm")).toBe(false);
  });

  it("keeps the forbidden page on the KD brand and returns no rows", () => {
    const html = productSignupsForbiddenHtml();
    expect(html).toContain("KD");
    expect(html).not.toContain("Kayden Chiew");
    expect(html).toContain("You do not have access to the client sign-up list.");
    expect(html).toContain("无权查看客户注册名单。");
    expect(html).not.toMatch(/axpm/i);
    expect(html).not.toContain("example.com");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("verified.customer@example.com");
    expect(withoutAxpmBrand("AXPM Ops Floor")).toBe("KD Ops Floor");
    expect(withoutAxpmBrand("AXPM 运营楼层")).toBe("KD 运营楼层");
    expect(withoutAxpmBrand("Kayden Chiew Ops Floor")).toBe("KD Ops Floor");
    expect(withoutAxpmBrand("Kayden Chiew 运营楼层")).toBe("KD 运营楼层");
    expect(withoutAxpmBrand("Clients")).toBe("Clients");
  });

  it("uses English and 中文 verified copy without a not-built placeholder", () => {
    const zhSection = zh.productSignups;
    const zhNavSection = zh.nav;
    const zhNav = zhNavSection && typeof zhNavSection !== "string" ? zhNavSection.productSignups : undefined;
    if (!zhSection || typeof zhSection === "string" || typeof zhNav !== "string") {
      throw new Error("missing Chinese sign-up copy");
    }
    const copy = [
      ...collectStrings(en.productSignups),
      ...collectStrings(zhSection),
      en.nav.productSignups,
      zhNav,
    ];
    expect(en.productSignups.subtitle).toBe(
      "People who created a KD account. CRM contacts and the founding waitlist are separate lists.",
    );
    expect(zhSection.subtitle).toBe("在 KD 创建账号的客户。CRM 联系人和创始等候名单不在此名单中。");
    expect(en.productSignups.colVerified).toBe("Email verified");
    expect(zhSection.colVerified).toBe("邮箱验证");
    expect(en.productSignups.verifiedAt).toBe("Verified · {time}");
    expect(en.productSignups.notVerified).toBe("Not verified");
    expect(zhSection.verifiedAt).toBe("已验证 · {time}");
    expect(zhSection.notVerified).toBe("未验证");
    expect(en.productSignups.countLine).toContain("{verified}");
    expect(en.productSignups.countLine).toContain("{not_verified}");
    expect(zhSection.countLine).toContain("{verified}");
    expect(zhSection.countLine).toContain("{not_verified}");
    expect(copy.join(" ")).toContain("KD");
    expect(copy.join(" ")).not.toContain("Kayden Chiew");
    expect(copy.join(" ")).not.toContain("Not built");
    expect(copy.join(" ")).not.toContain("尚未开通");
    expect(copy.join(" ")).not.toMatch(/not built/i);
    expect(zhSection.title).toMatch(/[\u4e00-\u9fff]/);
    for (const text of copy) expect(text).not.toMatch(/axpm/i);

    const component = fs.readFileSync(
      path.join(process.cwd(), "src/components/customers/product-signups-list.tsx"),
      "utf8",
    );
    expect(component).toContain("row.email_verified");
    expect(component).toContain("productSignups.verifiedAt");
    expect(component).toContain("productSignups.notVerified");
    expect(component).not.toContain("verifiedNotBuilt");
    expect(component).not.toContain("Not built");
    expect(component).not.toContain("尚未开通");
    expect(component).not.toMatch(/email_verified:\s*true/);
  });

  it("returns 403 with no rows for a fixture customer and lets staff through", async () => {
    process.env.AUTH_SECRET = "e".repeat(32);
    const customer = await createSessionToken({
      sub: "customer-fixture",
      role: "customer",
      email: "unverified.customer@example.com",
      name: "Unverified Customer",
    });
    const owner = await createSessionToken({
      sub: "owner-fixture",
      role: "owner",
      email: "owner.fixture@example.com",
      name: "Owner Fixture",
    });

    const denied = await middleware(
      new NextRequest("http://127.0.0.1:3000/dashboard/clients", {
        headers: { cookie: `${SESSION_COOKIE}=${customer}` },
      }),
    );
    expect(denied.status).toBe(403);
    const html = await denied.text();
    expect(html).toContain("<title>403 · KD</title>");
    expect(html).toContain(">KD<");
    expect(html).not.toContain("Kayden Chiew");
    expect(html).not.toContain("unverified.customer@example.com");
    expect(html).not.toContain("verified.customer@example.com");
    expect(html).not.toContain("<table");
    expect(html).not.toMatch(/axpm/i);

    const allowed = await middleware(
      new NextRequest("http://127.0.0.1:3000/dashboard/clients", {
        headers: { cookie: `${SESSION_COOKIE}=${owner}` },
      }),
    );
    expect(allowed.status).toBe(200);

    expect(
      decideApiAccess({
        pathname: "/api/staff/product-signups",
        role: "customer",
        cronAuthorized: false,
        bridgeAuthorized: false,
      }),
    ).toMatchObject({ allow: false, status: 403 });
    expect(
      decideApiAccess({
        pathname: "/api/staff/product-signups",
        role: "owner",
        cronAuthorized: false,
        bridgeAuthorized: false,
      }).allow,
    ).toBe(true);
  });

  it("shows staff a fixture list whose verified column comes from email_verified_at", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kd-signups-"));
    const usersPath = path.join(dir, "users.json");
    const accountsPath = path.join(dir, "accounts.json");
    fs.writeFileSync(
      usersPath,
      JSON.stringify({
        users: [
          {
            id: "owner-fixture",
            email: "owner.fixture@example.com",
            name: "Owner Fixture",
            role: "owner",
            password_hash: FIXTURE_SECRET,
            is_active: true,
            created_at: "2026-01-01T00:00:00.000Z",
            email_verified_at: "2026-01-02T00:00:00.000Z",
          },
          {
            id: "verified-customer",
            email: "verified.customer@example.com",
            name: "Verified Customer",
            role: "customer",
            password_hash: FIXTURE_SECRET,
            is_active: true,
            created_at: "2026-11-27T03:00:00.000Z",
            email_verified_at: VERIFIED_AT,
          },
          {
            id: "unverified-customer",
            email: "unverified.customer@example.com",
            name: "Unverified Customer",
            role: "customer",
            password_hash: FIXTURE_SECRET,
            is_active: false,
            created_at: "2026-11-01T00:00:00.000Z",
            email_verified_at: null,
          },
        ],
      }),
    );
    fs.writeFileSync(
      accountsPath,
      JSON.stringify({
        accounts: [
          { user_id: "verified-customer", plan: "pro", status: "trialing" },
          { user_id: "unverified-customer", plan: "free", status: "active" },
        ],
        api_keys: [],
      }),
    );
    process.env.AXPM_AUTH_USERS_PATH = usersPath;
    process.env.AXPM_CUSTOMER_ACCOUNTS_PATH = accountsPath;

    sessionBox.current = {
      user: {
        id: "unverified-customer",
        email: "unverified.customer@example.com",
        name: "Unverified Customer",
        role: "customer",
      },
      session: {
        sub: "unverified-customer",
        role: "customer",
        email: "unverified.customer@example.com",
        name: "Unverified Customer",
        exp: 9,
      },
    };
    const denied = await GET();
    expect(denied.status).toBe(403);
    const deniedBody = await denied.json();
    expect(deniedBody).toEqual({ error: "Forbidden" });
    expect(JSON.stringify(deniedBody)).not.toContain("example.com");
    expect(deniedBody.signups).toBeUndefined();

    sessionBox.current = {
      user: {
        id: "owner-fixture",
        email: "owner.fixture@example.com",
        name: "Owner Fixture",
        role: "owner",
      },
      session: {
        sub: "owner-fixture",
        role: "owner",
        email: "owner.fixture@example.com",
        name: "Owner Fixture",
        exp: 9,
      },
    };
    const allowed = await GET();
    expect(allowed.status).toBe(200);
    const body = await allowed.json();
    expect(body.signups.map((row: { email: string }) => row.email)).toEqual([
      "verified.customer@example.com",
      "unverified.customer@example.com",
    ]);
    expect(body.signups[0]).toMatchObject({
      email_verified: true,
      email_verified_at: VERIFIED_AT,
      email_verified_at_display: "2026-11-27 11:20",
    });
    expect(body.signups[1]).toMatchObject({
      email_verified: false,
      email_verified_at: null,
      email_verified_at_display: null,
    });
    expect(JSON.stringify(body)).not.toContain(FIXTURE_SECRET);
    expect(JSON.stringify(body)).not.toContain("not_built");
    expect(JSON.stringify(body)).not.toContain("owner.fixture@example.com");
  });
});
