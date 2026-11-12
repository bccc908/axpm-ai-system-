import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { method: string; body?: Record<string, unknown> }[] = [];
let chatType = "private";

vi.mock("@/lib/integrations/telegram", () => ({
  telegramRequest: vi.fn(async (method: string, body?: Record<string, unknown>) => {
    calls.push({ method, body });
    if (method === "getChat") return { ok: true, result: { type: chatType } };
    if (method === "sendMessage") return { ok: true, result: { message_id: 4242, chat: { id: 111 } } };
    return { ok: true, result: true };
  }),
}));

import { requestSignalApproval } from "./deliver";
import { handleApprovalCallback, parseApprovalCallback } from "./callbacks";
import { assertApproverChat, resetApproverCheckCache } from "./approver";
import { isApproved } from "./store";

const APPROVER = "111";
let dir: string;

function seed(engine: string, id: string) {
  mkdirSync(path.join(dir, "data"), { recursive: true });
  writeFileSync(
    path.join(dir, "data", `${engine}-signals.json`),
    JSON.stringify({ signals: [{ id, created_at: "2026-11-11T00:00:00Z", bias: "long" }], updated_at: "x" }),
  );
}
function stored(engine: string) {
  return JSON.parse(readFileSync(path.join(dir, "data", `${engine}-signals.json`), "utf8")).signals[0];
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sa-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = APPROVER;
  delete process.env.TELEGRAM_APPROVER_CHAT_ID;
  calls.length = 0;
  chatType = "private";
  resetApproverCheckCache();
});
afterEach(() => vi.restoreAllMocks());

describe("requestSignalApproval", () => {
  it("stores pending and sends only to the approver chat with buttons", async () => {
    seed("gold", "sig-1");
    const r = await requestSignalApproval({ engine: "gold", signalId: "sig-1", html: "<b>x</b>" });
    expect(r).toEqual({ ok: true, message_id: 4242, status: "pending" });
    const send = calls.find((c) => c.method === "sendMessage")!;
    expect(send.body!.chat_id).toBe(APPROVER);
    expect(String(send.body!.text)).toContain("PENDING APPROVAL");
    const kb = (send.body!.reply_markup as { inline_keyboard: { callback_data: string }[][] }).inline_keyboard[0];
    expect(kb.map((b) => b.callback_data)).toEqual(["sa:a:gold:sig-1", "sa:r:gold:sig-1"]);
    const row = stored("gold");
    expect(row.approval.status).toBe("pending");
    expect(row.approval.delivery.message_id).toBe(4242);
    expect(isApproved(row)).toBe(false);
  });

  it("prefers TELEGRAM_APPROVER_CHAT_ID over TELEGRAM_CHAT_ID", async () => {
    process.env.TELEGRAM_APPROVER_CHAT_ID = "222";
    process.env.TELEGRAM_CHAT_ID = "-100999"; // e.g. a client group later
    seed("btc", "sig-2");
    await requestSignalApproval({ engine: "btc", signalId: "sig-2", html: "x" });
    expect(calls.filter((c) => c.method === "sendMessage").map((c) => c.body!.chat_id)).toEqual(["222"]);
  });

  it("refuses to send when the approver chat is not private", async () => {
    chatType = "supergroup";
    seed("gold", "sig-3");
    const r = await requestSignalApproval({ engine: "gold", signalId: "sig-3", html: "x" });
    expect(r.ok).toBe(false);
    expect(calls.some((c) => c.method === "sendMessage")).toBe(false);
    expect(stored("gold").approval.status).toBe("pending");
    expect(stored("gold").approval.delivery.error).toMatch(/not a private chat/);
  });

  it("does not send without a token and records the error", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    seed("gold", "sig-4");
    const r = await requestSignalApproval({ engine: "gold", signalId: "sig-4", html: "x" });
    expect(r.ok).toBe(false);
    expect(calls.length).toBe(0);
  });

  it("assertApproverChat hard-refuses any other chat id", () => {
    expect(() => assertApproverChat("-100123")).toThrow();
    expect(() => assertApproverChat(null)).toThrow();
    expect(assertApproverChat(APPROVER)).toBe(APPROVER);
  });
});

describe("approve / reject callbacks", () => {
  const cb = (data: string, fromId = 111, chatId = 111) => ({
    id: "cbq",
    from: { id: fromId, username: "Xiong6622", first_name: "Kd", last_name: "C" },
    message: { message_id: 4242, chat: { id: chatId } },
    data,
  });

  it("parses callback data", () => {
    expect(parseApprovalCallback("sa:a:gold:abc")).toEqual({ action: "approved", engine: "gold", id: "abc" });
    expect(parseApprovalCallback("sa:r:nope:abc")).toBeNull();
  });

  it("approve records status, time and who; second tap does not change it", async () => {
    seed("gold", "sig-5");
    await requestSignalApproval({ engine: "gold", signalId: "sig-5", html: "x" });
    const out = await handleApprovalCallback(cb("sa:a:gold:sig-5"));
    expect(out).toMatchObject({ handled: true, status: "approved", changed: true });
    const a = stored("gold").approval;
    expect(a.status).toBe("approved");
    expect(a.decided_at).toBeTruthy();
    expect(a.decided_by).toEqual({ telegram_user_id: 111, username: "Xiong6622", name: "Kd C" });
    const again = await handleApprovalCallback(cb("sa:r:gold:sig-5"));
    expect(again).toMatchObject({ handled: true, status: "approved", changed: false });
    // approving sends nothing new: only answer + edit of the approver's own message
    const after = calls.slice(calls.findIndex((c) => c.method === "answerCallbackQuery"));
    expect(after.every((c) => ["answerCallbackQuery", "editMessageReplyMarkup"].includes(c.method))).toBe(true);
    expect(after.filter((c) => c.method === "editMessageReplyMarkup").every((c) => c.body!.chat_id === "111")).toBe(true);
  });

  it("reject records rejected", async () => {
    seed("btc", "sig-6");
    await requestSignalApproval({ engine: "btc", signalId: "sig-6", html: "x" });
    await handleApprovalCallback(cb("sa:r:btc:sig-6"));
    expect(stored("btc").approval.status).toBe("rejected");
  });

  it("ignores taps from anyone but the approver", async () => {
    seed("gold", "sig-7");
    await requestSignalApproval({ engine: "gold", signalId: "sig-7", html: "x" });
    const out = await handleApprovalCallback(cb("sa:a:gold:sig-7", 999, 999));
    expect(out.handled).toBe(false);
    expect(stored("gold").approval.status).toBe("pending");
  });
});
