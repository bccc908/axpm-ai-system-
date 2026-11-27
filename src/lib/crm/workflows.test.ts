import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n";
import { en } from "@/lib/i18n/locales/en";
import { zh } from "@/lib/i18n/locales/zh";
import { createClient, listTasks, listWorkflowRuns, updateClient } from "@/lib/crm/store";
import { formatWorkflowTimestamp } from "@/lib/crm/workflow-time";
import {
  buildRedactedPayload,
  composeOutbound,
  toApprovalWorkflowRun,
  WORKFLOW_ERROR_I18N_KEYS,
  WORKFLOW_ERRORS,
  workflowConditionMatches,
} from "@/lib/crm/workflow-engine";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { createLead, updateLead } from "@/lib/crm/zoho-store";
import { writeAppSettings } from "@/lib/finance/settings";
import {
  decideWorkflowRun,
  listCrmWorkflows,
  listWorkflowHistory,
  runLeadStatusWorkflows,
  saveCrmWorkflows,
} from "@/lib/crm/workflows";
import { DEFAULT_CRM_WORKFLOWS, type CrmWorkflow } from "@/types/crm-workflows";
import type { CrmLead } from "@/types/crm-zoho";

vi.mock("@/lib/integrations/telegram", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/telegram")>(
    "@/lib/integrations/telegram",
  );
  return {
    ...actual,
    sendTelegramMessage: vi.fn(async () => ({ ok: true as const })),
  };
});

const sendMock = vi.mocked(sendTelegramMessage);
const FAKE_TOKEN = "workflow-test-secret";
const FAKE_CHAT = "workflow-test-chat";
const EMAIL = "avery.secret@example.com";
const PHONE = "+16045550199";
const WHATSAPP = "wa-secret-handle";
const WECHAT = "wx-secret-handle";
const OWNER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

let dir = "";
let previousToken: string | undefined;
let previousChat: string | undefined;

function taskRule(partial: Partial<CrmWorkflow> & Pick<CrmWorkflow, "id" | "task_title">): CrmWorkflow {
  return {
    name: partial.name ?? partial.task_title,
    enabled: partial.enabled ?? true,
    trigger: partial.trigger ?? "lead_status",
    trigger_value: partial.trigger_value ?? "qualified",
    action: "create_task",
    condition: partial.condition ?? null,
    task_title: partial.task_title,
    id: partial.id,
  };
}

function notifyRule(id: string, message: string): CrmWorkflow {
  return {
    id,
    name: "Staff alert",
    enabled: true,
    trigger: "lead_status",
    trigger_value: "qualified",
    action: "notify_telegram",
    task_title: "",
    telegram_message: message,
    approver_user_id: OWNER_ID,
    condition: null,
  };
}

async function writeOwner() {
  const { writeFile, mkdir } = await import("fs/promises");
  await mkdir(path.join(dir, "data"), { recursive: true });
  await writeFile(
    path.join(dir, "data", "users.json"),
    JSON.stringify({
      users: [
        {
          id: OWNER_ID,
          email: "owner@example.com",
          name: "Ada Owner",
          role: "owner",
          password_hash: "hash-placeholder",
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  );
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "wf-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  previousToken = process.env.TELEGRAM_BOT_TOKEN;
  previousChat = process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  sendMock.mockReset();
  sendMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = previousToken;
  if (previousChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
  else process.env.TELEGRAM_CHAT_ID = previousChat;
});

async function leadWithClient() {
  return createLead({
    name: "Avery Chen",
    email: EMAIL,
    phone: PHONE,
    whatsapp: WHATSAPP,
    wechat: WECHAT,
    company: "Northwind",
    title: null,
    source: "website",
    channel: "web",
    status: "new",
    assigned_to: null,
    notes: `private note ${EMAIL} ${PHONE}`,
    client_id: "11111111-1111-1111-1111-111111111111",
  });
}

function assertRedacted(value: unknown) {
  const text = JSON.stringify(value);
  expect(text).not.toContain(EMAIL);
  expect(text).not.toContain(PHONE);
  expect(text).not.toContain(WHATSAPP);
  expect(text).not.toContain(WECHAT);
  expect(text).not.toContain(FAKE_TOKEN);
  expect(text).not.toContain(FAKE_CHAT);
  expect(text).not.toContain("private note");
  expect(text).not.toContain("password");
}

describe("workflow rules engine", () => {
  it("creates a task and an ok run for an enabled rule, and skips a disabled rule", async () => {
    await saveCrmWorkflows({
      workflows: [
        taskRule({ id: "enabled-rule", task_title: "Follow up qualified lead" }),
        taskRule({ id: "disabled-rule", task_title: "Disabled task", enabled: false }),
      ],
    });
    const lead = await leadWithClient();
    await updateLead(lead.id, { status: "qualified" }, { user_id: "staff-1", name: "Mina" });

    const tasks = (await listTasks()).filter((task) => task.title.includes("Avery Chen"));
    expect(tasks.map((task) => task.title)).toEqual(["Follow up qualified lead: Avery Chen"]);
    const runs = await listWorkflowRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      rule_id: "enabled-rule",
      result: "ok",
      task_id: tasks[0].id,
      actor_user_id: "staff-1",
      actor_name: "Mina",
    });
    assertRedacted(runs);
    expect(sendMock).not.toHaveBeenCalled();

    const settings = readFileSync(path.join(dir, "data", "settings.json"), "utf8");
    expect(settings).not.toContain("waiting-approval");
    expect(settings).not.toContain(runs[0].id);
    expect(settings).not.toContain(EMAIL);
  });

  it("records an error when a lead has no client and no deal", async () => {
    await saveCrmWorkflows({
      workflows: [taskRule({ id: "bare-rule", task_title: "Should not create" })],
    });
    const lead = await createLead({
      name: "Bare Lead",
      email: EMAIL,
      phone: PHONE,
      whatsapp: WHATSAPP,
      wechat: WECHAT,
      company: null,
      title: null,
      source: null,
      channel: null,
      status: "new",
      assigned_to: null,
      notes: `private note ${EMAIL}`,
      client_id: null,
    });
    const before = (await listTasks()).length;
    await updateLead(lead.id, { status: "qualified" }, { user_id: "staff-1", name: "Mina" });
    expect((await listTasks()).length).toBe(before);
    const runs = await listWorkflowRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].result).toBe("error");
    expect(runs[0].error_message).toBe("Lead has no client and no deal context");
    expect(runs[0].task_id).toBeNull();
    assertRedacted(runs);
  });

  it("does not fire lead status rules when a contact status changes", async () => {
    await saveCrmWorkflows({
      workflows: [taskRule({ id: "contact-rule", task_title: "Contact should not run" })],
    });
    const client = await createClient({
      name: "Contact",
      email: null,
      phone: null,
      whatsapp: null,
      wechat: null,
      lead_status: "new",
      deposit_amount: 0,
      deposit_currency: "CNY",
      ib_source: null,
      tags: [],
      assigned_to: null,
      notes: null,
      next_follow_up_at: null,
    });
    await updateClient(client.id, { lead_status: "qualified" });
    expect(await listWorkflowRuns()).toHaveLength(0);
  });

  it("holds a Telegram alert until approval, sends once, and does not send on reject", async () => {
    process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN;
    process.env.TELEGRAM_CHAT_ID = FAKE_CHAT;
    await writeOwner();
    await saveCrmWorkflows({
      workflows: [notifyRule("notify-ok", "Ready: {name} ({company})")],
    });
    const lead = await leadWithClient();
    await updateLead(lead.id, { status: "qualified" }, { user_id: "staff-2", name: "Ren" });
    expect(sendMock).not.toHaveBeenCalled();
    const waiting = await listWorkflowRuns();
    expect(waiting[0].result).toBe("waiting-approval");
    expect(waiting[0].actor_user_id).toBe("staff-2");
    expect(toApprovalWorkflowRun(waiting[0]).outbound_message).toBe("Ready: Avery Chen (Northwind)");
    const listed = await listWorkflowHistory();
    expect(listed[0]?.outbound_message).toBeNull();
    expect(JSON.stringify(listed)).not.toContain("Ready: Avery Chen (Northwind)");
    assertRedacted(waiting);

    const rejected = await decideWorkflowRun({
      runId: waiting[0].id,
      decision: "reject",
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(rejected.ok).toBe(true);
    if (rejected.ok) {
      expect(rejected.run.result).toBe("rejected");
      expect(rejected.run.rejected_by).toMatchObject({ user_id: OWNER_ID, name: "Ada Owner" });
      expect(rejected.run.rejected_at).toEqual(expect.any(String));
    }
    expect(sendMock).not.toHaveBeenCalled();

    await saveCrmWorkflows({
      workflows: [notifyRule("notify-send", "Ready: {name} ({company})")],
    });
    const second = await createLead({
      name: "Avery Chen",
      email: EMAIL,
      phone: PHONE,
      whatsapp: null,
      wechat: null,
      company: "Northwind",
      title: null,
      source: "website",
      channel: null,
      status: "contacted",
      assigned_to: null,
      notes: null,
      client_id: "11111111-1111-1111-1111-111111111111",
    });
    await updateLead(second.id, { status: "qualified" }, { user_id: "staff-2", name: "Ren" });
    const pending = (await listWorkflowRuns()).find((run) => run.rule_id === "notify-send");
    expect(pending?.result).toBe("waiting-approval");
    const approved = await decideWorkflowRun({
      runId: pending!.id,
      decision: "approve",
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(approved.run.result).toBe("ok");
      expect(approved.run.approved_by?.user_id).toBe(OWNER_ID);
      expect(approved.run.approved_at).toEqual(expect.any(String));
      expect(approved.run.outbound_message).toBeNull();
      expect(approved.run.payload_redacted.message_preview).toBe("Ready: Avery Chen (Northwind)");
    }
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toBe("Ready: Avery Chen (Northwind)");
    expect(String(sendMock.mock.calls[0][0])).not.toContain(FAKE_TOKEN);
    expect(String(sendMock.mock.calls[0][0])).not.toMatch(/Grok|AXPM|\bIB\b/);

    const again = await decideWorkflowRun({
      runId: pending!.id,
      decision: "approve",
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe(409);
    expect(sendMock).toHaveBeenCalledTimes(1);
    assertRedacted(await listWorkflowRuns());
  });

  it("records an error on approve when Telegram is not configured or paused, and allows one retry", async () => {
    await writeOwner();
    await saveCrmWorkflows({
      workflows: [notifyRule("notify-missing", "Hello {name}")],
    });
    const lead = await leadWithClient();
    await runLeadStatusWorkflows(lead, "qualified", { user_id: "system", name: "system" });
    const waiting = (await listWorkflowRuns())[0];
    const missing = await decideWorkflowRun({
      runId: waiting.id,
      decision: "approve",
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(missing.ok).toBe(true);
    if (missing.ok) {
      expect(missing.run.result).toBe("error");
      expect(missing.run.error_message).toBe("Telegram is not configured");
      expect(missing.run.approved_by?.user_id).toBe(OWNER_ID);
    }
    expect(sendMock).not.toHaveBeenCalled();

    process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN;
    process.env.TELEGRAM_CHAT_ID = FAKE_CHAT;
    await writeAppSettings({ crmWorkflowNotifyTelegram: false });
    const paused = await decideWorkflowRun({
      runId: waiting.id,
      decision: "approve",
      retry: true,
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(paused.ok).toBe(true);
    if (paused.ok) {
      expect(paused.run.result).toBe("error");
      expect(paused.run.error_message).toBe("Telegram sends are paused by settings");
    }
    expect(sendMock).not.toHaveBeenCalled();
    const spent = await decideWorkflowRun({
      runId: waiting.id,
      decision: "approve",
      retry: true,
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(spent.ok).toBe(false);
    if (!spent.ok) expect(spent.status).toBe(409);

    const sales = await decideWorkflowRun({
      runId: waiting.id,
      decision: "approve",
      retry: true,
      actor: { user_id: "sales-1", name: "Sam", role: "sales" },
    });
    expect(sales.ok).toBe(false);
    if (!sales.ok) expect(sales.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("retries a failed send once and then refuses another send", async () => {
    process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN;
    process.env.TELEGRAM_CHAT_ID = FAKE_CHAT;
    await writeOwner();
    await saveCrmWorkflows({ workflows: [notifyRule("notify-retry", "Ping {name}")] });
    const lead = await leadWithClient();
    await updateLead(lead.id, { status: "qualified" });
    const waiting = (await listWorkflowRuns())[0];
    sendMock.mockResolvedValueOnce({ ok: false, error: "bot failed workflow-test-secret" });
    const failed = await decideWorkflowRun({
      runId: waiting.id,
      decision: "approve",
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(failed.ok && failed.run.result).toBe("error");
    if (failed.ok) expect(failed.run.error_message).toBe("Telegram send failed");
    assertRedacted(await listWorkflowRuns());
    const withoutRetry = await decideWorkflowRun({
      runId: waiting.id,
      decision: "approve",
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(withoutRetry.ok).toBe(false);
    sendMock.mockResolvedValueOnce({ ok: true });
    const retried = await decideWorkflowRun({
      runId: waiting.id,
      decision: "approve",
      retry: true,
      actor: { user_id: OWNER_ID, name: "Ada Owner", role: "owner" },
    });
    expect(retried.ok && retried.run.result).toBe("ok");
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("keeps saved order and scrubs legacy default copy", async () => {
    await saveCrmWorkflows({
      workflows: [
        taskRule({ id: "later", task_title: "Later task", trigger_value: "new" }),
        taskRule({ id: "sooner", task_title: "Sooner task" }),
      ],
    });
    await saveCrmWorkflows({
      workflows: [
        taskRule({ id: "sooner", task_title: "Sooner task" }),
        taskRule({ id: "later", task_title: "Later task", trigger_value: "new", enabled: false }),
      ],
    });
    const ordered = await listCrmWorkflows();
    expect(ordered.map((rule) => rule.id)).toEqual(["sooner", "later"]);
    expect(ordered[1].enabled).toBe(false);

    await writeAppSettings({
      crmWorkflows: [
        {
          id: "wf-deal-deposited",
          name: "Deposited stage onboarding",
          enabled: true,
          trigger: "deal_stage",
          trigger_value: "stage-deposited",
          action: "create_task",
          task_title: "Confirm deposit and onboard IB",
        },
        {
          id: "wf-deal-deposited-telegram",
          name: "Deposited deal Telegram alert",
          enabled: true,
          trigger: "deal_stage",
          trigger_value: "stage-deposited",
          action: "notify_telegram",
          task_title: "",
          telegram_message: "Deal deposited — onboard IB: {title} ({amount})",
          approver_user_id: OWNER_ID,
        },
      ],
    });
    const scrubbed = await listCrmWorkflows();
    const blob = JSON.stringify(scrubbed);
    expect(blob).not.toMatch(/onboard IB|\bIB\b|broker|AXPM/i);
    expect(scrubbed[0].task_title).toBe("Confirm deposit and start onboarding");
    expect(scrubbed[1].telegram_message).toBe("Deal deposited — start onboarding: {title} ({amount})");
  });

  it("drops contact fields from the redacted payload and matches only allowlisted conditions", () => {
    const lead = {
      id: "lead-1",
      name: "Avery Chen",
      email: EMAIL,
      phone: PHONE,
      whatsapp: WHATSAPP,
      wechat: WECHAT,
      company: "Northwind",
      title: null,
      source: "website",
      channel: "web",
      status: "qualified",
      assigned_to: "user-9",
      notes: "secret notes",
      client_id: "client-1",
      account_id: null,
      deal_id: null,
      converted_at: null,
      custom_fields: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    } satisfies CrmLead;
    const payload = buildRedactedPayload({
      rule: {
        id: "rule",
        name: "Rule",
        trigger: "lead_status",
        trigger_value: "qualified",
      },
      lead,
      messagePreview: composeOutbound("Hello {name}", {
        name: "Avery Chen",
        company: "Northwind",
        title: "",
        amount: "",
        status: "qualified",
        stage: "",
      }),
    });
    assertRedacted(payload);
    expect(payload.display_name).toBe("Avery Chen");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("notes");

    expect(
      workflowConditionMatches(
        { field: "lead.source", op: "eq", value: "website" },
        { lead, deal: null },
      ),
    ).toBe(true);
    expect(
      workflowConditionMatches(
        { field: "deal.amount", op: "gte", value: "100" },
        { lead, deal: { currency: "CNY", amount: 80 } },
      ),
    ).toBe(false);
    expect(
      workflowConditionMatches(
        { field: "deal.amount", op: "gte", value: "100" },
        { lead, deal: { currency: "CNY", amount: 100 } },
      ),
    ).toBe(true);
    expect(workflowConditionMatches(null, { lead, deal: null })).toBe(true);
  });

  it("shows Asia/Shanghai and keeps product copy free of banned wording", () => {
    const stamp = formatWorkflowTimestamp("2026-11-26T17:23:00.000Z", "en");
    expect(stamp).toBe("27 Nov 2026, 01:23 GMT+8");
    const zhStamp = formatWorkflowTimestamp("2026-11-26T17:23:00.000Z", "zh");
    expect(zhStamp).toBe("2026年11月27日 GMT+8 01:23");
    expect(stamp).toMatch(/\d{2}:\d{2}/);
    expect(zhStamp).toMatch(/\d{2}:\d{2}/);
    expect(JSON.stringify(DEFAULT_CRM_WORKFLOWS)).not.toMatch(/onboard IB|\bIB\b|broker|AXPM|Grok/i);

    const keys = Object.keys(en.workflowRules);
    expect(Object.keys(zh.workflowRules).sort()).toEqual([...keys].sort());
    const banned = /axpm|broker|\bIB\b|经纪/i;
    for (const key of keys) {
      const enText = translate(en, `workflowRules.${key}`);
      const zhText = translate(zh, `workflowRules.${key}`);
      expect(enText).not.toBe(`workflowRules.${key}`);
      expect(zhText).not.toBe(`workflowRules.${key}`);
      expect(enText).not.toMatch(banned);
      expect(zhText).not.toMatch(banned);
    }
    expect(translate(en, "workflowRules.title")).not.toBe(translate(zh, "workflowRules.title"));
    expect(translate(en, "nav.workflowRules")).not.toMatch(banned);
    expect(translate(zh, "nav.workflowRules")).not.toMatch(banned);
    expect(translate(zh, "workflowRules.exactMessage")).toBe("待发送的消息");
    expect(translate(en, "workflowRules.exactMessage")).toBe("Message that would be sent");
    expect(translate(zh, "workflowRules.firesAlone")).toBe("仅在触发时运行，无额外条件");
    expect(translate(en, "workflowRules.firesAlone")).toBe("Fires on the trigger alone");
    expect(translate(zh, "workflowRules.denyForbidden")).toBe("没有权限");
    expect(translate(zh, "workflowRules.denyUnauthorized")).toBe("未登录");
    for (const message of Object.values(WORKFLOW_ERRORS)) {
      const key = WORKFLOW_ERROR_I18N_KEYS[message];
      expect(translate(en, key)).not.toBe(key);
      expect(translate(zh, key)).not.toBe(key);
      expect(translate(zh, key)).not.toBe(message);
    }

    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const depNames = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");
    expect(depNames).not.toMatch(/n8n|dify|flowise|langflow|novaflow/i);
    for (const relative of [
      "src/lib/crm/workflows.ts",
      "src/lib/crm/workflow-engine.ts",
      "src/components/crm/workflow-rules-screen.tsx",
      "src/components/crm/crm-workflows-panel.tsx",
    ]) {
      const source = readFileSync(path.join(root, relative), "utf8");
      expect(source).not.toMatch(/n8n|dify|flowise|langflow|novaflow|openai|Grok Trading/i);
      expect(source).not.toMatch(/\bIB\b|broker|AXPM/);
    }
    const screen = readFileSync(path.join(root, "src/components/crm/workflow-rules-screen.tsx"), "utf8");
    expect(screen).not.toMatch(/TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID|password/);
    expect(screen).not.toMatch(/description=\{t\("workflowRules\.historyHint"\)\}[\s\S]*workflow-rule-list|workflow-rule-list[\s\S]{0,200}historyHint/);
  });
});

describe("timestamp colon", () => {
  it("inserts a colon when Intl drops the time separator", () => {
    const Real = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation((locales, options) => {
      const formatter = new Real(locales as string, options);
      return new Proxy(formatter, {
        get(target, prop, receiver) {
          if (prop === "format") return () => "27 Nov 2026, 0123 GMT+8";
          if (prop === "formatToParts") {
            return (date?: Date) =>
              target.formatToParts(date).map((part) =>
                part.type === "literal" ? { ...part, value: part.value.replace(/:/g, "") } : part,
              );
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
    const stamp = formatWorkflowTimestamp("2026-11-26T17:23:00.000Z", "en");
    const zhStamp = formatWorkflowTimestamp("2026-11-26T17:23:00.000Z", "zh");
    expect(stamp).toContain("01:23");
    expect(stamp).not.toMatch(/0123/);
    expect(zhStamp).toContain("01:23");
    expect(zhStamp).not.toMatch(/0123/);
    spy.mockRestore();
  });
});
