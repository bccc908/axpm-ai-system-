import { readFile } from "fs/promises";
import path from "path";
import { withFileLock, writeJsonAtomic } from "@/lib/auth/atomic-json";
import { sendAuthEmail } from "@/lib/auth/mailer";

export const OWNER_ALERT_RECIPIENT = "bcchiew214@gmail.com";

const FALLBACK_FROM = "Kayden Chiew <no-reply@kaydenchiew.com>";
const SENDING_STALE_MS = 60_000;

export type OwnerAlertEvent = "signed_up" | "email_verified";

export interface OwnerCustomerAlert {
  event: OwnerAlertEvent;
  userId: string;
  name: string;
  email: string;
  occurredAt: string;
  plan: string;
  blocked: boolean;
}

interface AlertRow {
  user_id: string;
  event: OwnerAlertEvent;
  status: "sending" | "sent" | "failed";
  attempts: number;
  updated_at: string;
}

interface AlertLog {
  rows: AlertRow[];
}

/**
 * First attempt is immediate. Later attempts wait, and the waits stay inside one minute.
 * Tests replace `sleep` so they do not wait on the clock.
 */
export const ownerAlertTiming = {
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  retryDelaysMs: [5_000, 20_000] as readonly number[],
};

const inflight = new Set<Promise<void>>();

export function ownerAlertsSettled(): Promise<void> {
  return Promise.all([...inflight]).then(() => undefined);
}

function track(work: Promise<void>): void {
  const done = work.then(
    () => undefined,
    () => undefined,
  );
  inflight.add(done);
  void done.finally(() => {
    inflight.delete(done);
  });
}

function alertLogFile(): string {
  const override = process.env.OWNER_ALERT_LOG_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), "data", "owner-alert-log.json");
}

export function ownerAlertFromAddress(): string {
  const configured = process.env.AUTH_EMAIL_FROM?.replace(/[\r\n]/g, "").trim() ?? "";
  if (!configured) return FALLBACK_FROM;
  const internalBrand = ["a", "x", "p", "m"].join("");
  const lower = configured.toLowerCase();
  if (lower.includes(internalBrand) || lower.includes("signal flag")) return FALLBACK_FROM;
  return configured;
}

export function redactAlertLogText(value: string): string {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  let out = value;
  if (key && key !== "mock") out = out.split(key).join("[redacted]");
  return out
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 180);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatOwnerAlertTime(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((part) => part.type === type)?.value ?? "").padStart(2, "0");
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  return `${year}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")} UTC+8`;
}

const EVENT_COPY: Record<OwnerAlertEvent, { en: string; zh: string }> = {
  signed_up: { en: "New customer sign-up", zh: "新客户注册" },
  email_verified: { en: "Customer email verified", zh: "客户邮箱已验证" },
};

/** Draft placeholder. Compliance has not cleared C-SV1–4. Not final Marketing copy. */
export function buildOwnerAlertDraft(input: OwnerCustomerAlert): { subject: string; text: string; html: string } {
  const copy = EVENT_COPY[input.event];
  const when = formatOwnerAlertTime(input.occurredAt);
  const subject = `[DRAFT] ${copy.en} / ${copy.zh} — Kayden Chiew`;
  const text = [
    "DRAFT TEMPLATE — Compliance has not cleared C-SV1. Customer name and email in this alert are pending Compliance review. This is not final Marketing copy.",
    "",
    `Event: ${input.event}`,
    copy.en,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Time (UTC+8): ${when}`,
    `Plan: ${input.plan}`,
    "Brand: Kayden Chiew",
    "",
    "Staff Clients list is not built yet. This note is not a link to the customer list.",
    "",
    "草稿模板 — 合规审核尚未通过 C-SV1。邮件中的客户姓名和邮箱仍待合规确认，不是最终市场文案。",
    copy.zh,
    "员工客户列表尚未完成。此说明不是客户列表链接。",
  ].join("\n");
  const html = [
    "<p><strong>DRAFT TEMPLATE</strong> — Compliance has not cleared C-SV1. Customer name and email in this alert are pending Compliance review. This is not final Marketing copy.</p>",
    `<p>Event: ${escapeHtml(input.event)}<br>${escapeHtml(copy.en)}</p>`,
    `<p>Name: ${escapeHtml(input.name)}<br>Email: ${escapeHtml(input.email)}<br>Time (UTC+8): ${escapeHtml(when)}<br>Plan: ${escapeHtml(input.plan)}<br>Brand: Kayden Chiew</p>`,
    "<p>Staff Clients list is not built yet. This note is not a link to the customer list.</p>",
    `<p>草稿模板 — 合规审核尚未通过 C-SV1。邮件中的客户姓名和邮箱仍待合规确认，不是最终市场文案。</p>`,
    `<p>${escapeHtml(copy.zh)}</p>`,
    "<p>员工客户列表尚未完成。此说明不是客户列表链接。</p>",
  ].join("");
  return { subject, text, html };
}

async function readLog(): Promise<AlertLog> {
  try {
    const parsed = JSON.parse(await readFile(alertLogFile(), "utf8")) as Partial<AlertLog>;
    return { rows: Array.isArray(parsed.rows) ? parsed.rows : [] };
  } catch {
    return { rows: [] };
  }
}

async function claim(userId: string, event: OwnerAlertEvent): Promise<"send" | "skip"> {
  const file = alertLogFile();
  return withFileLock(`${file}.lock`, async () => {
    const data = await readLog();
    const row = data.rows.find((item) => item.user_id === userId && item.event === event);
    if (row?.status === "sent") return "skip";
    if (row?.status === "sending" && Date.now() - Date.parse(row.updated_at) < SENDING_STALE_MS) return "skip";
    const next: AlertRow = {
      user_id: userId,
      event,
      status: "sending",
      attempts: (row?.attempts ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
    if (row) Object.assign(row, next);
    else data.rows.push(next);
    await writeJsonAtomic(file, data);
    return "send";
  });
}

async function mark(userId: string, event: OwnerAlertEvent, status: "sent" | "failed"): Promise<void> {
  const file = alertLogFile();
  await withFileLock(`${file}.lock`, async () => {
    const data = await readLog();
    const row = data.rows.find((item) => item.user_id === userId && item.event === event);
    if (!row) return;
    row.status = status;
    row.updated_at = new Date().toISOString();
    await writeJsonAtomic(file, data);
  });
}

async function attempt(input: OwnerCustomerAlert): Promise<"sent" | "skipped" | "failed"> {
  if (input.blocked || !input.userId) return "skipped";
  const decision = await claim(input.userId, input.event);
  if (decision === "skip") return "skipped";
  try {
    const draft = buildOwnerAlertDraft(input);
    await sendAuthEmail({
      to: OWNER_ALERT_RECIPIENT,
      from: ownerAlertFromAddress(),
      subject: draft.subject,
      html: draft.html,
      text: draft.text,
    });
    await mark(input.userId, input.event, "sent");
    return "sent";
  } catch (error) {
    await mark(input.userId, input.event, "failed");
    const message = error instanceof Error ? error.message : "send failed";
    console.error("[owner-alert]", input.event, input.userId, redactAlertLogText(message));
    return "failed";
  }
}

async function deliver(input: OwnerCustomerAlert): Promise<void> {
  const first = await attempt(input);
  if (first !== "failed") return;
  for (const delay of ownerAlertTiming.retryDelaysMs) {
    await ownerAlertTiming.sleep(delay);
    const again = await attempt(input);
    if (again !== "failed") return;
  }
}

/** Best-effort. Does not throw and does not block the caller. */
export function startOwnerCustomerAlert(input: OwnerCustomerAlert): void {
  if (input.blocked || !input.userId) return;
  track(
    deliver(input).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "send failed";
      console.error("[owner-alert]", input.event, input.userId, redactAlertLogText(message));
    }),
  );
}
