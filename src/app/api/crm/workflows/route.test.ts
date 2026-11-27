import { mkdtempSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/lib/auth/types";
import { GET as historyGet } from "@/app/api/crm/workflows/history/route";
import { GET, PATCH } from "@/app/api/crm/workflows/route";
import { POST as decidePost } from "@/app/api/crm/workflows/runs/[id]/route";
import { canSeeWorkflowOutbound } from "@/lib/crm/workflow-access";
import { createLead, updateLead } from "@/lib/crm/zoho-store";
import { saveCrmWorkflows } from "@/lib/crm/workflows";

const gate = vi.hoisted(() => ({
  session: null as null | {
    session: { sub: string; role: UserRole; email: string; name: string; exp: number };
    user: { id: string; name: string; email: string; role: UserRole };
  },
}));

vi.mock("@/lib/auth/api-session", () => ({
  getServerSession: async () => gate.session,
}));

function user(role: UserRole, id = `${role}-1`) {
  gate.session = {
    session: {
      sub: id,
      role,
      email: `${role}@example.com`,
      name: role,
      exp: 4_000_000_000,
    },
    user: { id, name: role, email: `${role}@example.com`, role },
  };
}

let dir = "";

beforeEach(() => {
  gate.session = null;
  dir = mkdtempSync(path.join(tmpdir(), "wf-api-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workflow rule HTTP access", () => {
  it("returns 401 when nobody is signed in", async () => {
    expect((await GET()).status).toBe(401);
    expect((await PATCH(new Request("http://127.0.0.1/api/crm/workflows", { method: "PATCH", body: "{}" }))).status).toBe(401);
    expect((await historyGet(new Request("http://127.0.0.1/api/crm/workflows/history"))).status).toBe(401);
    const denied = await decidePost(new Request("http://127.0.0.1/api/crm/workflows/runs/x", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(denied.status).toBe(401);
  });

  it("returns 403 for customer, viewer, finance, and personal", async () => {
    for (const role of ["customer", "viewer", "finance", "personal"] as const) {
      user(role);
      expect((await GET()).status).toBe(403);
      expect((await historyGet(new Request("http://127.0.0.1/api/crm/workflows/history"))).status).toBe(403);
      const denied = await decidePost(
        new Request("http://127.0.0.1/api/crm/workflows/runs/x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision: "approve" }),
        }),
        { params: Promise.resolve({ id: "x" }) },
      );
      expect(denied.status).toBe(403);
      expect((await PATCH(new Request("http://127.0.0.1/api/crm/workflows", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflows: [] }),
      }))).status).toBe(403);
    }
  });

  it("lets sales view and refuses edits and approval", async () => {
    user("sales");
    const listed = await GET();
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.access).toBe("view");
    expect(body.can_approve).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/TELEGRAM_BOT_TOKEN|hasToken|hasChatId|workflow-test-secret/);
    expect((await PATCH(new Request("http://127.0.0.1/api/crm/workflows", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflows: [] }),
    }))).status).toBe(403);
    const denied = await decidePost(
      new Request("http://127.0.0.1/api/crm/workflows/runs/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(denied.status).toBe(403);
  });

  it("lets an owner create, disable, re-enable, and reorder rules", async () => {
    user("owner");
    const first = await PATCH(new Request("http://127.0.0.1/api/crm/workflows", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workflows: [
          {
            id: "rule-b",
            name: "Second rule",
            enabled: true,
            trigger: "lead_status",
            trigger_value: "qualified",
            condition: { field: "lead.source", op: "eq", value: "website" },
            action: "create_task",
            task_title: "Call the lead",
          },
          {
            id: "rule-a",
            name: "First rule",
            enabled: false,
            trigger: "deal_stage",
            trigger_value: "stage-deposited",
            condition: null,
            action: "create_task",
            task_title: "Confirm deposit and start onboarding",
          },
        ],
      }),
    }));
    expect(first.status).toBe(200);
    const created = await first.json();
    expect(created.workflows.map((rule: { id: string; enabled: boolean }) => [rule.id, rule.enabled])).toEqual([
      ["rule-b", true],
      ["rule-a", false],
    ]);

    const reordered = await PATCH(new Request("http://127.0.0.1/api/crm/workflows", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workflows: [
          { ...created.workflows[1], enabled: true },
          created.workflows[0],
        ],
      }),
    }));
    expect(reordered.status).toBe(200);
    const saved = await reordered.json();
    expect(saved.workflows.map((rule: { id: string; enabled: boolean }) => [rule.id, rule.enabled])).toEqual([
      ["rule-a", true],
      ["rule-b", true],
    ]);
    const listed = await GET();
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.workflows.map((rule: { id: string }) => rule.id)).toEqual(["rule-a", "rule-b"]);
    expect(body.access).toBe("edit");
    expect(body.can_approve).toBe(true);
    expect(body.telegram).toEqual({ ready: false, configured: false, paused: false });
  });

  it("hides the composed message from sales and shows it to owner, admin, and the named approver", async () => {
    const composed = "Ping Avery Chen";
    await mkdir(path.join(dir, "data"), { recursive: true });
    await writeFile(
      path.join(dir, "data", "users.json"),
      JSON.stringify({
        users: [
          { id: "owner-1", email: "owner@example.com", name: "Owner", role: "owner", password_hash: "hash-placeholder", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
          { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin", password_hash: "hash-placeholder", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
          { id: "sales-1", email: "sales@example.com", name: "Sales", role: "sales", password_hash: "hash-placeholder", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    );
    await saveCrmWorkflows({
      workflows: [
        {
          id: "notify-visibility",
          name: "Staff alert",
          enabled: true,
          trigger: "lead_status",
          trigger_value: "qualified",
          action: "notify_telegram",
          task_title: "",
          telegram_message: "Ping {name}",
          approver_user_id: "admin-1",
          condition: null,
        },
      ],
    });
    const lead = await createLead({
      name: "Avery Chen",
      email: null,
      phone: null,
      whatsapp: null,
      wechat: null,
      company: "Northwind",
      title: null,
      source: null,
      channel: null,
      status: "new",
      assigned_to: null,
      notes: null,
      client_id: null,
    });
    await updateLead(lead.id, { status: "qualified" });

    user("sales");
    const sales = await GET();
    expect(sales.status).toBe(200);
    const salesText = JSON.stringify(await sales.json());
    expect(salesText).not.toContain(composed);
    const salesHistory = await historyGet(new Request("http://127.0.0.1/api/crm/workflows/history"));
    expect(JSON.stringify(await salesHistory.json())).not.toContain(composed);

    user("owner");
    const ownerBody = await (await GET()).json();
    expect(JSON.stringify(ownerBody)).toContain(composed);
    expect(ownerBody.waiting[0].outbound_message).toBe(composed);

    user("admin");
    const adminBody = await (await GET()).json();
    expect(adminBody.waiting[0].outbound_message).toBe(composed);
    expect(adminBody.waiting[0].approver_user_id).toBe("admin-1");

    expect(canSeeWorkflowOutbound("sales", "sales-1", "sales-1")).toBe(false);
    expect(canSeeWorkflowOutbound("owner", "owner-1", "admin-1")).toBe(true);
    expect(canSeeWorkflowOutbound("admin", "admin-1", "admin-1")).toBe(true);
    expect(canSeeWorkflowOutbound("viewer", "admin-1", "admin-1")).toBe(true);
    expect(canSeeWorkflowOutbound("viewer", "other", "admin-1")).toBe(false);
  });
});
