import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { createSessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE, type UserRole } from "@/lib/auth/types";

async function requestAs(role: UserRole | null, pathname: string) {
  const headers = new Headers();
  if (role) {
    const token = await createSessionToken({
      sub: "user-1",
      role,
      email: "person@example.com",
      name: "Person",
    });
    headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  }
  return middleware(new NextRequest(new URL(pathname, "http://127.0.0.1:3000"), { headers }));
}

describe("workflow rules middleware", () => {
  it("allows owner, admin, and sales to open the page", async () => {
    for (const role of ["owner", "admin", "sales"] as const) {
      const response = await requestAs(role, "/dashboard/crm/workflow-rules");
      expect(response.status).toBe(200);
    }
  });

  it("denies customer, viewer, finance, and personal on the page and APIs", async () => {
    const paths = [
      "/dashboard/crm/workflow-rules",
      "/api/crm/workflows",
      "/api/crm/workflows/history",
      "/api/crm/workflows/runs/example",
    ];
    for (const role of ["customer", "viewer", "finance", "personal"] as const) {
      for (const pathname of paths) {
        const response = await requestAs(role, pathname);
        expect(response.status, `${role} ${pathname}`).toBe(403);
      }
    }
  });

  it("returns 401 for anonymous callers", async () => {
    for (const pathname of [
      "/dashboard/crm/workflow-rules",
      "/api/crm/workflows",
      "/api/crm/workflows/history",
      "/api/crm/workflows/runs/example",
    ]) {
      const response = await requestAs(null, pathname);
      expect(response.status).toBe(401);
    }
  });

  it("uses 中文 deny copy for a 中文 session and English otherwise", async () => {
    const headers = new Headers({ cookie: "kc-locale=zh" });
    const token = await createSessionToken({
      sub: "customer-1",
      role: "customer",
      email: "customer@example.com",
      name: "Customer",
    });
    headers.set("cookie", `kc-locale=zh; ${SESSION_COOKIE}=${token}`);
    const zh = await middleware(
      new NextRequest(new URL("http://127.0.0.1:3000/dashboard/crm/workflow-rules"), { headers }),
    );
    expect(zh.status).toBe(403);
    const zhBody = await zh.text();
    expect(zhBody).toContain("没有权限");
    expect(zhBody).not.toContain("Forbidden");

    const enHeaders = new Headers();
    enHeaders.set("cookie", `${SESSION_COOKIE}=${token}`);
    const en = await middleware(
      new NextRequest(new URL("http://127.0.0.1:3000/dashboard/crm/workflow-rules"), { headers: enHeaders }),
    );
    expect(en.status).toBe(403);
    const enBody = await en.text();
    expect(enBody).toContain("Forbidden");
    expect(enBody).not.toContain("没有权限");

    const anon = await middleware(
      new NextRequest(new URL("http://127.0.0.1:3000/dashboard/crm/workflow-rules"), {
        headers: { "accept-language": "zh-CN,zh;q=0.9", cookie: "kc-locale=zh" },
      }),
    );
    expect(anon.status).toBe(401);
    expect(await anon.text()).toContain("未登录");
  });
});
