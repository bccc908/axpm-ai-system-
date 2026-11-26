import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  apiRoutePathFromFile,
  decideApiAccess,
  describeRule,
  matchApiRule,
} from "@/lib/auth/api-policy";
import { middleware } from "@/middleware";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";

const SAMPLE_ADMIN = [
  "/api/crm/export",
  "/api/system/restore",
  "/api/settings",
  "/api/finance/overview",
  "/api/whatsapp/send",
  "/api/voice/transcribe",
  "/api/ai/market-advisor/chat",
  "/api/knowledge-base",
  "/api/gold-signals/generate",
];

const saved = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  LOCAL_API_KEY: process.env.LOCAL_API_KEY,
};

afterEach(() => {
  restore("AUTH_SECRET", saved.AUTH_SECRET);
  restore("CRON_SECRET", saved.CRON_SECRET);
  restore("LOCAL_API_KEY", saved.LOCAL_API_KEY);
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function decide(pathname: string, role: UserRole | null, extra?: { cron?: boolean; bridge?: boolean }) {
  return decideApiAccess({
    pathname,
    role,
    cronAuthorized: extra?.cron ?? false,
    bridgeAuthorized: extra?.bridge ?? false,
  });
}

function listRouteFiles() {
  const root = process.cwd();
  const base = path.join(root, "src", "app", "api");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(base);
  return out.sort();
}

describe("api access policy", () => {
  it("maps every API route and denies anything unmapped", () => {
    const files = listRouteFiles();
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) {
      const route = apiRoutePathFromFile(file);
      expect(matchApiRule(route), file).not.toBeNull();
    }
    expect(decide("/api/not-a-real-route", "owner").allow).toBe(false);
    expect(decide("/api/not-a-real-route", null)).toMatchObject({ allow: false, status: 401 });
  });

  it("gives a public user 403 on admin routes and lets owner and admin through", () => {
    for (const route of SAMPLE_ADMIN) {
      expect(decide(route, "customer"), route).toMatchObject({ allow: false, status: 403 });
      expect(decide(route, null), route).toMatchObject({ allow: false, status: 401 });
      expect(decide(route, "admin").allow, route).toBe(true);
      expect(decide(route, "owner").allow, route).toBe(true);
    }
  });

  it("keeps fortune and account open for the public role", () => {
    expect(decide("/api/fortune/generate", "customer").allow).toBe(true);
    expect(decide("/api/fortune/readings", "customer").allow).toBe(true);
    expect(decide("/api/account", "customer").allow).toBe(true);
    expect(decide("/api/account/checkout", "customer").allow).toBe(true);
    expect(decide("/api/auth/signup", null).allow).toBe(true);
    expect(decide("/api/auth/login", null).allow).toBe(true);
  });

  it("does not let a longer prefix steal a more specific rule", () => {
    expect(matchApiRule("/api/gold-signals/mt5")?.kind).toBe("bridge");
    expect(matchApiRule("/api/gold-signals/generate")?.kind).toBe("module");
    expect(matchApiRule("/api/email/send-digest")?.kind).toBe("cron-or-roles");
    expect(matchApiRule("/api/email/send")?.kind).toBe("module");
    expect(matchApiRule("/api/fortune/daily")?.kind).toBe("cron");
    expect(matchApiRule("/api/fortune/automation")?.kind).toBe("module");
    expect(matchApiRule("/api/personal/todos/abc")?.kind).toBe("module");
    expect(describeRule(matchApiRule("/api/personal/todos/abc")!)).toContain("todos");
    expect(matchApiRule("/api/personal/jobs")?.kind).toBe("module");
    expect(describeRule(matchApiRule("/api/personal/jobs")!)).toContain("assistant");
    expect(matchApiRule("/api/system/backup")?.kind).toBe("cron-or-roles");
    expect(matchApiRule("/api/system/restore")?.kind).toBe("module");
    expect(matchApiRule("/api/crm/export")?.kind).toBe("roles");
    expect(describeRule(matchApiRule("/api/crm/export")!)).toBe("owner, admin");
  });

  it("keeps CRM for sales and viewer but locks export to owner and admin", () => {
    for (const role of ["sales", "viewer", "customer"] as const) {
      expect(decide("/api/crm/export", role), role).toMatchObject({ allow: false, status: 403 });
    }
    expect(decide("/api/crm/export", "owner").allow).toBe(true);
    expect(decide("/api/crm/export", "admin").allow).toBe(true);
    expect(decide("/api/crm/leads", "sales").allow).toBe(true);
    expect(decide("/api/crm/leads", "viewer").allow).toBe(true);
    expect(decide("/api/crm/overview", "customer")).toMatchObject({ allow: false, status: 403 });
  });

  it("fails closed for cron and bridge when the key is absent", () => {
    expect(decide("/api/digest/daily", null)).toMatchObject({ allow: false, status: 401 });
    expect(decide("/api/digest/daily", "customer")).toMatchObject({ allow: false, status: 403 });
    expect(decide("/api/digest/daily", null, { cron: true }).allow).toBe(true);
    expect(decide("/api/digest/daily", "owner").allow).toBe(true);
    expect(decide("/api/gold-signals/mt5", "owner")).toMatchObject({ allow: false, status: 401 });
    expect(decide("/api/gold-signals/mt5", null, { bridge: true }).allow).toBe(true);
    expect(decide("/api/signals/approvals/poll", "owner")).toMatchObject({ allow: false, status: 401 });
  });
});

describe("middleware role gate", () => {
  it("returns 403 for a public user, 200 for admin, and 401 when the secret is missing", async () => {
    process.env.AUTH_SECRET = "a".repeat(32);
    delete process.env.CRON_SECRET;
    delete process.env.LOCAL_API_KEY;

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

    const customerExport = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/crm/export", {
        headers: { cookie: `${SESSION_COOKIE}=${customer}` },
      }),
    );
    expect(customerExport.status).toBe(403);

    const adminExport = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/system/restore", {
        headers: { cookie: `${SESSION_COOKIE}=${admin}` },
      }),
    );
    expect(adminExport.status).toBe(200);

    const anon = await middleware(new NextRequest("http://127.0.0.1:3000/api/whatsapp/send"));
    expect(anon.status).toBe(401);

    const fortune = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/fortune/readings", {
        headers: { cookie: `${SESSION_COOKIE}=${customer}` },
      }),
    );
    expect(fortune.status).toBe(200);

    const mt5 = await middleware(new NextRequest("http://127.0.0.1:3000/api/gold-signals/mt5"));
    expect(mt5.status).toBe(401);

    const cron = await middleware(new NextRequest("http://127.0.0.1:3000/api/digest/daily"));
    expect(cron.status).toBe(401);

    delete process.env.AUTH_SECRET;
    const forged = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/settings", {
        headers: { cookie: `${SESSION_COOKIE}=${admin}` },
      }),
    );
    expect(forged.status).toBe(401);
  });
});
