import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();

vi.mock("@/lib/auth/api-session", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("@/lib/crm/zoho-store", () => ({
  exportLeadsCsv: vi.fn(async () => "name,email\nAda,ada@example.com\n"),
  exportContactsCsv: vi.fn(async () => "name\nAda\n"),
}));

import { GET } from "./route";
import type { UserRole } from "@/lib/auth/types";

function asRole(role: UserRole) {
  getServerSession.mockResolvedValue({
    user: { id: "user-1", email: `${role}@example.com`, name: role, role },
    session: { sub: "user-1", role, email: `${role}@example.com`, name: role, exp: 9 },
  });
}

function request() {
  return new Request("http://127.0.0.1:3000/api/crm/export?type=leads");
}

describe("GET /api/crm/export", () => {
  beforeEach(() => {
    getServerSession.mockReset();
  });

  it.each(["sales", "viewer", "customer"] as const)("%s gets 403", async (role) => {
    asRole(role);
    const res = await GET(request());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Forbidden" });
  });

  it.each(["owner", "admin"] as const)("%s gets 200", async (role) => {
    asRole(role);
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(await res.text()).toContain("name,email");
  });
});
