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
});
