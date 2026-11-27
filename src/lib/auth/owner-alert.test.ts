import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { createEmailToken } from "@/lib/auth/email-token";
import { clearRateLimits } from "@/lib/auth/rate-limit";
import { createOwnerAccount, findUserByEmail, registerCustomer } from "@/lib/auth/store";
import { isEmailVerified } from "@/lib/auth/verification";
import {
  OWNER_ALERT_RECIPIENT,
  buildOwnerAlertDraft,
  ownerAlertTiming,
  ownerAlertsSettled,
  startOwnerCustomerAlert,
} from "@/lib/auth/owner-alert";

const PASSWORD = "horse-battery-99";
const CUSTOMER_EMAIL = "ada@example.com";
const CUSTOMER_NAME = "Ada Example";

const saved = {
  AUTH_SECRET: process.env.AUTH_SECRET,
  AXPM_AUTH_USERS_PATH: process.env.AXPM_AUTH_USERS_PATH,
  AXPM_CUSTOMER_ACCOUNTS_PATH: process.env.AXPM_CUSTOMER_ACCOUNTS_PATH,
  AUTH_MAIL_OUTBOX: process.env.AUTH_MAIL_OUTBOX,
  OWNER_ALERT_LOG_PATH: process.env.OWNER_ALERT_LOG_PATH,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  AUTH_EMAIL_MODE: process.env.AUTH_EMAIL_MODE,
  AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_RECIPIENTS: process.env.EMAIL_RECIPIENTS,
  SIGNUP_BLOCK_MAINLAND: process.env.SIGNUP_BLOCK_MAINLAND,
};

let dir: string | null = null;

interface OutboxMessage {
  from?: string;
  to?: string[];
  subject?: string;
  text?: string;
  html?: string;
}

interface AlertRow {
  user_id: string;
  event: string;
  status: string;
  attempts: number;
  updated_at: string;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearRateLimits();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = null;
});

async function useTempAuth(mode: "mock" | "live" = "mock") {
  dir = await mkdtemp(path.join(os.tmpdir(), "kc-owner-alert-"));
  process.env.AUTH_SECRET = "f".repeat(32);
  process.env.AXPM_AUTH_USERS_PATH = path.join(dir, "users.json");
  process.env.AXPM_CUSTOMER_ACCOUNTS_PATH = path.join(dir, "accounts.json");
  process.env.AUTH_MAIL_OUTBOX = path.join(dir, "outbox.json");
  process.env.OWNER_ALERT_LOG_PATH = path.join(dir, "alerts.json");
  process.env.EMAIL_FROM = "Digest Desk <digest@example.com>";
  process.env.EMAIL_RECIPIENTS = "other@example.com";
  delete process.env.SIGNUP_BLOCK_MAINLAND;
  if (mode === "mock") {
    process.env.AUTH_EMAIL_MODE = "mock";
    process.env.RESEND_API_KEY = "mock";
    process.env.AUTH_EMAIL_FROM = "Kayden Chiew <no-reply@kaydenchiew.com>";
  } else {
    process.env.AUTH_EMAIL_MODE = "live";
    process.env.RESEND_API_KEY = "test-not-a-real-resend-key";
    process.env.AUTH_EMAIL_FROM = "Kayden Chiew <no-reply@kaydenchiew.com>";
  }
  clearRateLimits();
  await createOwnerAccount({
    email: "owner@example.com",
    name: "Owner",
    password: "owner-password-123",
  });
}

function signupRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1/api/auth/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": headers["x-forwarded-for"] ?? "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const signupBody = {
  email: CUSTOMER_EMAIL,
  name: CUSTOMER_NAME,
  password: PASSWORD,
};

async function readOutbox(): Promise<OutboxMessage[]> {
  try {
    const parsed = JSON.parse(await readFile(process.env.AUTH_MAIL_OUTBOX!, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as OutboxMessage[]) : [];
  } catch {
    return [];
  }
}

async function readAlertRows(): Promise<AlertRow[]> {
  try {
    const parsed = JSON.parse(await readFile(process.env.OWNER_ALERT_LOG_PATH!, "utf8")) as {
      rows?: AlertRow[];
    };
    return parsed.rows ?? [];
  } catch {
    return [];
  }
}

function ownerMessages(outbox: OutboxMessage[]): OutboxMessage[] {
  return outbox.filter((message) => message.to?.includes(OWNER_ALERT_RECIPIENT));
}

function joined(message: OutboxMessage): string {
  return `${message.subject ?? ""}\n${message.text ?? ""}\n${message.html ?? ""}`;
}

function hangingSleep() {
  const queued: Array<() => void> = [];
  const sleep = vi.spyOn(ownerAlertTiming, "sleep").mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        queued.push(resolve);
      }),
  );
  return {
    async drain() {
      sleep.mockResolvedValue(undefined);
      for (let i = 0; i < 6; i += 1) {
        const pending = queued.splice(0);
        for (const resolve of pending) resolve();
        await Promise.resolve();
      }
      await ownerAlertsSettled();
    },
  };
}

describe("owner signup alert draft", () => {
  it("uses draft bilingual Kayden Chiew copy and leaves the staff list as a note", () => {
    const at = "2026-11-27T00:30:00.000Z";
    const signedUp = buildOwnerAlertDraft({
      event: "signed_up",
      userId: "user-1",
      name: CUSTOMER_NAME,
      email: CUSTOMER_EMAIL,
      occurredAt: at,
      plan: "free",
      blocked: false,
    });
    const verified = buildOwnerAlertDraft({
      event: "email_verified",
      userId: "user-1",
      name: CUSTOMER_NAME,
      email: CUSTOMER_EMAIL,
      occurredAt: at,
      plan: "free",
      blocked: false,
    });

    expect(signedUp.subject).toContain("[DRAFT]");
    expect(signedUp.subject).toContain("Kayden Chiew");
    expect(signedUp.subject).not.toContain(CUSTOMER_EMAIL);
    expect(joined(signedUp)).toContain("signed_up");
    expect(joined(signedUp)).toContain("New customer sign-up");
    expect(joined(signedUp)).toContain("新客户注册");
    expect(joined(verified)).toContain("email_verified");
    expect(joined(verified)).toContain("Customer email verified");
    expect(joined(verified)).toContain("客户邮箱已验证");

    for (const message of [signedUp, verified]) {
      const body = joined(message);
      expect(body).toContain("DRAFT TEMPLATE");
      expect(body).toContain("C-SV1");
      expect(body).toContain("pending Compliance");
      expect(body).toContain("合规审核尚未通过 C-SV1");
      expect(body).toContain(CUSTOMER_NAME);
      expect(body).toContain(CUSTOMER_EMAIL);
      expect(body).toContain("free");
      expect(body).toContain("2026-11-27 08:30 UTC+8");
      expect(body).toContain("Staff Clients list is not built yet");
      expect(body).toContain("员工客户列表尚未完成");
      expect(body).not.toMatch(/axpm/i);
      expect(body).not.toMatch(/signal flag/i);
      expect(body).not.toContain(PASSWORD);
    }
  });
});

describe("owner alerts on customer signup and verification", () => {
  it("sends one owner alert when signup succeeds and does not use the digest recipient", async () => {
    await useTempAuth("mock");
    const response = await signup(signupRequest(signupBody));
    expect(response.status).toBe(200);
    await ownerAlertsSettled();

    const outbox = await readOutbox();
    const alerts = ownerMessages(outbox);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.from).toBe("Kayden Chiew <no-reply@kaydenchiew.com>");
    expect(alerts[0]?.to).toEqual([OWNER_ALERT_RECIPIENT]);
    expect(OWNER_ALERT_RECIPIENT).toBe("bcchiew214@gmail.com");
    expect(joined(alerts[0] ?? {})).toContain("signed_up");
    expect(joined(alerts[0] ?? {})).toContain(CUSTOMER_EMAIL);
    expect(joined(alerts[0] ?? {})).not.toContain(PASSWORD);
    expect(outbox.some((message) => message.to?.includes(CUSTOMER_EMAIL))).toBe(true);

    const customer = await findUserByEmail(CUSTOMER_EMAIL);
    expect(customer?.role).toBe("customer");
    expect(joined(alerts[0] ?? {})).not.toContain(customer?.password_hash ?? "missing-hash");
    expect(joined(alerts[0] ?? {})).not.toContain(customer?.verify_nonce ?? "missing-nonce");
    const accounts = JSON.parse(await readFile(process.env.AXPM_CUSTOMER_ACCOUNTS_PATH!, "utf8")) as {
      accounts: Array<{ user_id: string; plan: string }>;
    };
    expect(accounts.accounts).toEqual([
      expect.objectContaining({ user_id: customer?.id, plan: "free" }),
    ]);

    const rawLog = await readFile(process.env.OWNER_ALERT_LOG_PATH!, "utf8");
    expect(rawLog).not.toContain(CUSTOMER_EMAIL);
    expect(rawLog).not.toContain(PASSWORD);
    expect(rawLog).not.toContain(customer?.password_hash);
    const rows = await readAlertRows();
    expect(rows).toEqual([
      expect.objectContaining({ user_id: customer?.id, event: "signed_up", status: "sent" }),
    ]);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "attempts",
      "event",
      "status",
      "updated_at",
      "user_id",
    ]);

    startOwnerCustomerAlert({
      event: "signed_up",
      userId: customer!.id,
      name: CUSTOMER_NAME,
      email: CUSTOMER_EMAIL,
      occurredAt: customer!.created_at,
      plan: "free",
      blocked: false,
    });
    await ownerAlertsSettled();
    expect(ownerMessages(await readOutbox())).toHaveLength(1);
  });

  it("ignores EMAIL_FROM when AUTH_EMAIL_FROM is unset", async () => {
    await useTempAuth("mock");
    delete process.env.AUTH_EMAIL_FROM;
    const response = await signup(signupRequest(signupBody, { "x-forwarded-for": "203.0.113.11" }));
    expect(response.status).toBe(200);
    await ownerAlertsSettled();
    const [alert] = ownerMessages(await readOutbox());
    expect(alert?.from).toBe("Kayden Chiew <no-reply@kaydenchiew.com>");
    expect(alert?.from).not.toContain("digest@example.com");
    expect(alert?.to).toEqual(["bcchiew214@gmail.com"]);
  });

  it("returns signup success before a failing owner alert finishes and keeps the account", async () => {
    await useTempAuth("live");
    let releaseOwner: () => void = () => {};
    const ownerGate = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.resend.com/emails");
      const body = String(init?.body ?? "");
      if (body.includes(OWNER_ALERT_RECIPIENT)) {
        await ownerGate;
        return new Response(`down ${CUSTOMER_EMAIL} ${process.env.RESEND_API_KEY}`, { status: 500 });
      }
      return Response.json({ id: "customer-mail" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map((part) => String(part)).join(" "));
    });
    const sleeper = hangingSleep();

    try {
    const pending = signup(signupRequest(signupBody, { "x-forwarded-for": "203.0.113.12" }));
    const raced = await Promise.race([
      pending.then(async (response) => ({ kind: "response" as const, status: response.status })),
      new Promise<{ kind: "timeout" }>((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 800)),
    ]);
    expect(raced).toEqual({ kind: "response", status: 200 });

    const customer = await findUserByEmail(CUSTOMER_EMAIL);
    expect(customer?.email).toBe(CUSTOMER_EMAIL);
    expect(isEmailVerified(customer!)).toBe(false);
    const accounts = JSON.parse(await readFile(process.env.AXPM_CUSTOMER_ACCOUNTS_PATH!, "utf8")) as {
      accounts: Array<{ user_id: string }>;
    };
    expect(accounts.accounts.map((account) => account.user_id)).toContain(customer?.id);

    releaseOwner();
    await vi.waitFor(async () => {
      const rows = await readAlertRows();
      expect(rows.some((row) => row.event === "signed_up" && row.status === "failed")).toBe(true);
    });
    expect(errors.join("\n")).not.toContain(CUSTOMER_EMAIL);
    expect(errors.join("\n")).not.toContain(PASSWORD);
    expect(errors.join("\n")).not.toContain("test-not-a-real-resend-key");
    const rawLog = await readFile(process.env.OWNER_ALERT_LOG_PATH!, "utf8");
    expect(rawLog).not.toContain(CUSTOMER_EMAIL);
    expect(rawLog).not.toContain(PASSWORD);
    expect(await findUserByEmail(CUSTOMER_EMAIL)).toBeTruthy();
    } finally {
      await sleeper.drain();
    }
  });

  it("retries a failed owner alert once and does not send a duplicate after it arrives", async () => {
    await useTempAuth("live");
    let ownerAttempts = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.resend.com/emails");
      expect(String(url)).not.toMatch(/smtp|gmail/i);
      const body = String(init?.body ?? "");
      if (body.includes(OWNER_ALERT_RECIPIENT)) {
        ownerAttempts += 1;
        if (ownerAttempts === 1) return new Response("temporary outage", { status: 500 });
        return Response.json({ id: "owner-alert-1" });
      }
      return Response.json({ id: "customer-mail" });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sleep = vi.spyOn(ownerAlertTiming, "sleep").mockResolvedValue(undefined);

    const response = await signup(signupRequest(signupBody, { "x-forwarded-for": "203.0.113.13" }));
    expect(response.status).toBe(200);
    await ownerAlertsSettled();

    expect(ownerAttempts).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(ownerAlertTiming.retryDelaysMs.reduce((sum, delay) => sum + delay, 0)).toBeLessThanOrEqual(60_000);
    const customer = await findUserByEmail(CUSTOMER_EMAIL);
    expect(await readAlertRows()).toEqual([
      expect.objectContaining({
        user_id: customer?.id,
        event: "signed_up",
        status: "sent",
        attempts: 2,
      }),
    ]);

    const callsAfterSuccess = ownerAttempts;
    startOwnerCustomerAlert({
      event: "signed_up",
      userId: customer!.id,
      name: CUSTOMER_NAME,
      email: CUSTOMER_EMAIL,
      occurredAt: customer!.created_at,
      plan: "free",
      blocked: false,
    });
    await ownerAlertsSettled();
    expect(ownerAttempts).toBe(callsAfterSuccess);
  });

  it("sends email_verified once and does not send again when the link is reused", async () => {
    await useTempAuth("mock");
    expect((await signup(signupRequest(signupBody, { "x-forwarded-for": "203.0.113.14" }))).status).toBe(200);
    await ownerAlertsSettled();

    const customerMail = (await readOutbox()).find((message) => message.to?.includes(CUSTOMER_EMAIL));
    const link = customerMail?.text?.match(/https?:\/\/\S+/)?.[0];
    const token = new URL(link ?? "").searchParams.get("token");
    expect(token).toBeTruthy();

    const verify = await verifyEmail(
      new Request("http://127.0.0.1/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(verify.status).toBe(200);
    await ownerAlertsSettled();

    const alerts = ownerMessages(await readOutbox());
    expect(alerts.filter((message) => joined(message).includes("email_verified"))).toHaveLength(1);
    expect(alerts.filter((message) => joined(message).includes("signed_up"))).toHaveLength(1);
    expect(joined(alerts.find((message) => joined(message).includes("email_verified")) ?? {})).not.toContain(token);
    expect(joined(alerts.find((message) => joined(message).includes("email_verified")) ?? {})).not.toContain(PASSWORD);
    expect(isEmailVerified((await findUserByEmail(CUSTOMER_EMAIL))!)).toBe(true);

    const again = await verifyEmail(
      new Request("http://127.0.0.1/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(again.status).toBe(400);
    await ownerAlertsSettled();
    expect(ownerMessages(await readOutbox()).filter((message) => joined(message).includes("email_verified"))).toHaveLength(1);
  });

  it("does not alert when verification is confirmed for an already verified customer", async () => {
    await useTempAuth("mock");
    const created = await registerCustomer({
      email: CUSTOMER_EMAIL,
      name: CUSTOMER_NAME,
      password: PASSWORD,
    });
    const raw = JSON.parse(await readFile(process.env.AXPM_AUTH_USERS_PATH!, "utf8")) as {
      users: Array<{ id: string; verify_nonce?: string | null; email_verified_at?: string | null }>;
    };
    const row = raw.users.find((user) => user.id === created.id);
    expect(row?.verify_nonce).toBeTruthy();
    row!.email_verified_at = "2026-11-27T00:00:00.000Z";
    await import("fs/promises").then((fs) =>
      fs.writeFile(process.env.AXPM_AUTH_USERS_PATH!, JSON.stringify(raw), "utf8"),
    );
    const token = await createEmailToken({
      sub: created.id,
      purpose: "verify-email",
      nonce: row!.verify_nonce!,
    });

    const response = await verifyEmail(
      new Request("http://127.0.0.1/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect([200, 400]).toContain(response.status);
    await ownerAlertsSettled();
    expect(ownerMessages(await readOutbox())).toHaveLength(0);
    expect(isEmailVerified((await findUserByEmail(CUSTOMER_EMAIL))!)).toBe(true);
  });

  it("does not alert when signup is rejected or when the mainland block rejects it", async () => {
    await useTempAuth("mock");

    const invalid = await signup(
      signupRequest({ email: "not-an-email", name: "", password: "short" }, { "x-forwarded-for": "203.0.113.20" }),
    );
    expect(invalid.status).toBe(400);

    const duplicateSeed = await registerCustomer({
      email: "taken@example.com",
      name: "Taken",
      password: PASSWORD,
    });
    const duplicate = await signup(
      signupRequest(
        { email: "taken@example.com", name: "Taken", password: PASSWORD },
        { "x-forwarded-for": "203.0.113.21" },
      ),
    );
    expect(duplicate.status).toBe(400);
    expect(duplicateSeed.id).toBeTruthy();

    process.env.SIGNUP_BLOCK_MAINLAND = "1";
    const blocked = await signup(
      signupRequest(signupBody, { "x-forwarded-for": "203.0.113.22", "cf-ipcountry": "CN" }),
    );
    expect(blocked.status).toBe(403);
    expect(await findUserByEmail(CUSTOMER_EMAIL)).toBeNull();

    const hongKong = await signup(
      signupRequest(
        { email: "hk@example.com", name: "Hong Kong", password: PASSWORD },
        { "x-forwarded-for": "203.0.113.23", "cf-ipcountry": "HK" },
      ),
    );
    expect(hongKong.status).toBe(200);

    delete process.env.SIGNUP_BLOCK_MAINLAND;
    const mainlandAllowed = await signup(
      signupRequest(
        { email: "cn-open@example.com", name: "Open", password: PASSWORD },
        { "x-forwarded-for": "203.0.113.24", "cf-ipcountry": "cn" },
      ),
    );
    expect(mainlandAllowed.status).toBe(200);

    startOwnerCustomerAlert({
      event: "signed_up",
      userId: "no-row",
      name: CUSTOMER_NAME,
      email: CUSTOMER_EMAIL,
      occurredAt: "2026-11-27T00:30:00.000Z",
      plan: "free",
      blocked: true,
    });
    startOwnerCustomerAlert({
      event: "signed_up",
      userId: "",
      name: CUSTOMER_NAME,
      email: CUSTOMER_EMAIL,
      occurredAt: "2026-11-27T00:30:00.000Z",
      plan: "free",
      blocked: false,
    });
    await ownerAlertsSettled();

    const alerts = ownerMessages(await readOutbox());
    const addresses = alerts.map((message) => joined(message));
    expect(addresses.some((body) => body.includes(CUSTOMER_EMAIL))).toBe(false);
    expect(addresses.some((body) => body.includes("taken@example.com"))).toBe(false);
    expect(alerts.filter((message) => joined(message).includes("hk@example.com"))).toHaveLength(1);
    expect(alerts.filter((message) => joined(message).includes("cn-open@example.com"))).toHaveLength(1);
    expect((await readAlertRows()).some((row) => row.user_id === "no-row")).toBe(false);
  });

  it("keeps a verified customer verified when the owner alert fails", async () => {
    await useTempAuth("mock");
    expect((await signup(signupRequest(signupBody, { "x-forwarded-for": "203.0.113.30" }))).status).toBe(200);
    await ownerAlertsSettled();
    const customerMail = (await readOutbox()).find((message) => message.to?.includes(CUSTOMER_EMAIL));
    const token = new URL(customerMail?.text?.match(/https?:\/\/\S+/)?.[0] ?? "").searchParams.get("token");

    process.env.AUTH_EMAIL_MODE = "live";
    process.env.RESEND_API_KEY = "test-not-a-real-resend-key";
    let releaseOwner: () => void = () => {};
    const ownerGate = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = String(init?.body ?? "");
        if (body.includes(OWNER_ALERT_RECIPIENT)) {
          await ownerGate;
          return new Response("down", { status: 500 });
        }
        return Response.json({ id: "ignored" });
      }),
    );
    const sleeper = hangingSleep();
    vi.spyOn(console, "error").mockImplementation(() => {});

    try {
    const pending = verifyEmail(
      new Request("http://127.0.0.1/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    const raced = await Promise.race([
      pending.then(async (response) => ({ kind: "response" as const, status: response.status })),
      new Promise<{ kind: "timeout" }>((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 800)),
    ]);
    expect(raced).toEqual({ kind: "response", status: 200 });
    expect(isEmailVerified((await findUserByEmail(CUSTOMER_EMAIL))!)).toBe(true);
    releaseOwner();
    await vi.waitFor(async () => {
      expect((await readAlertRows()).some((row) => row.event === "email_verified" && row.status === "failed")).toBe(
        true,
      );
    });
    expect(isEmailVerified((await findUserByEmail(CUSTOMER_EMAIL))!)).toBe(true);
    } finally {
      await sleeper.drain();
    }
  });
});
