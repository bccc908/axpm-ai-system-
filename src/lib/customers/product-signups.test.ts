import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/locales/en";
import { zh } from "@/lib/i18n/locales/zh";
import type { UserRole } from "@/lib/auth/types";
import {
  buildProductSignupList,
  canViewProductSignups,
  formatInKualaLumpur,
  isProductSignupsPath,
  productSignupsForbiddenHtml,
  withoutAxpmBrand,
  type ProductSignupUser,
} from "@/lib/customers/product-signups";

const NOW = new Date("2026-11-27T04:00:00.000Z");
const FIXTURE_SECRET = "fixture-hash-not-a-password";
const FIXTURE_KEY = "sk-fixture-not-a-key";

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
          email: "owner@example.com",
          created_at: "2026-11-27T03:30:00.000Z",
        }),
        user({
          id: "signup-new",
          role: "customer",
          name: "New Signup",
          email: "new.signup@example.com",
          created_at: "2026-11-27T03:00:00.000Z",
        }),
        user({
          id: "signup-week",
          role: "customer",
          name: "Week Signup",
          email: "week.signup@example.com",
          created_at: "2026-11-25T04:00:00.000Z",
        }),
        user({
          id: "signup-old",
          role: "customer",
          name: "Old Signup",
          email: "old.signup@example.com",
          is_active: false,
          created_at: "2026-11-01T00:00:00.000Z",
        }),
        user({ id: "sales-1", role: "sales", created_at: "2026-11-27T03:59:00.000Z" }),
      ],
      [
        { user_id: "signup-new", plan: "pro", status: "trialing" },
        { user_id: "signup-old", plan: "free", status: "active" },
      ],
      NOW,
    );

    expect(list.signups.map((row) => row.id)).toEqual(["signup-new", "signup-week", "signup-old"]);
    expect(list.signups[0]).toMatchObject({
      email: "new.signup@example.com",
      signed_up_at_display: "2026-11-27 11:00",
      email_verification: "not_built",
      plan: "pro",
      account_status: "trialing",
      login_active: true,
    });
    expect(list.signups[1]).toMatchObject({
      plan: null,
      account_status: null,
      signed_up_at_display: "2026-11-25 12:00",
    });
    expect(list.signups[2].login_active).toBe(false);
    expect(list.counts).toEqual({ all: 3, last_24_hours: 1, last_7_days: 2, active: 2 });
    expect(list.as_of_display).toBe("2026-11-27 12:00");
    expect(list.timezone).toBe("Asia/Kuala_Lumpur");
    expect(list.email_verification).toBe("not_built");

    const serialized = JSON.stringify(list);
    expect(serialized).not.toContain(FIXTURE_SECRET);
    expect(serialized).not.toContain(FIXTURE_KEY);
    expect(serialized).not.toContain("password");
  });

  it("formats midnight in Kuala Lumpur as 00:00 and breaks ties by id", () => {
    expect(formatInKualaLumpur("2026-11-26T16:00:00.000Z")).toBe("2026-11-27 00:00");
    const list = buildProductSignupList(
      [
        user({ id: "b-customer", role: "customer", created_at: "2026-11-26T16:00:00.000Z" }),
        user({ id: "a-customer", role: "customer", created_at: "2026-11-26T16:00:00.000Z" }),
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

  it("keeps the forbidden page on the Kayden Chiew brand", () => {
    const html = productSignupsForbiddenHtml();
    expect(html).toContain("Kayden Chiew");
    expect(html).toContain("无权查看客户注册名单。");
    expect(html).not.toMatch(/axpm/i);
    expect(withoutAxpmBrand("AXPM Ops Floor")).toBe("KD Ops Floor");
    expect(withoutAxpmBrand("AXPM 运营楼层")).toBe("KD 运营楼层");
    expect(withoutAxpmBrand("Clients")).toBe("Clients");
  });

  it("uses English and 中文 copy without the internal brand", () => {
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
    expect(copy.join(" ")).toContain("Kayden Chiew");
    expect(zhSection.title).toMatch(/[\u4e00-\u9fff]/);
    expect(zhSection.verifiedNotBuilt).toBe("尚未开通");
    for (const text of copy) expect(text).not.toMatch(/axpm/i);
  });
});
