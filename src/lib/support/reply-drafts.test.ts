import { mkdtemp, rm, readFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendTelegramMessage = vi.fn();
vi.mock("@/lib/integrations/telegram", () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));

const tempDirs: string[] = [];

async function useTempDraftFile() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "axpm-reply-drafts-"));
  tempDirs.push(dir);
  process.env.AXPM_REPLY_DRAFTS_FILE = path.join(dir, "reply-drafts.json");
  return process.env.AXPM_REPLY_DRAFTS_FILE;
}

beforeEach(async () => {
  sendTelegramMessage.mockReset();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_APPROVER_CHAT_ID;
  await useTempDraftFile();
});

afterEach(async () => {
  delete process.env.AXPM_REPLY_DRAFTS_FILE;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("reply draft store and review", () => {
  it("stores a sample question as pending approval and lists it", async () => {
    const { storePendingReplyDraft } = await import("@/lib/support/draft-approval");
    const { listReplyDrafts, getReplyDraft } = await import("@/lib/support/reply-drafts");

    const draft = await storePendingReplyDraft({
      channel: "web",
      clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
      customerQuestion: "What are your office hours?",
      replies: [
        "Our team is available 9:00-18:00 Malaysia time on weekdays.",
        "Alternative hours reply",
      ],
      provider: "deepseek",
      fallback: false,
      source: "reply_agent",
      notify: false,
    });

    expect(draft).not.toBeNull();
    expect(draft!.status).toBe("pending_approval");
    expect(draft!.clientName).toBe("AUDIT_FAKE_CLIENT_NOT_REAL");
    expect(draft!.customerQuestion).toBe("What are your office hours?");
    expect(draft!.draftReply).toContain("9:00-18:00");
    expect(draft!.alternatives).toEqual(["Alternative hours reply"]);
    expect(draft!.provider).toBe("deepseek");
    expect(draft!.notifiedTelegram).toBe(false);
    expect(sendTelegramMessage).not.toHaveBeenCalled();

    const pending = await listReplyDrafts({ status: "pending_approval" });
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(draft!.id);

    const stored = await getReplyDraft(draft!.id);
    expect(stored).toMatchObject({
      id: draft!.id,
      status: "pending_approval",
      channel: "web",
    });

    const file = process.env.AXPM_REPLY_DRAFTS_FILE!;
    const raw = JSON.parse(await readFile(file, "utf-8")) as { drafts: unknown[] };
    expect(raw.drafts).toHaveLength(1);
  });

  it("approve and reject record a decision and never mark delivery", async () => {
    const { storePendingReplyDraft, reviewReplyDraft } = await import(
      "@/lib/support/draft-approval"
    );

    const first = await storePendingReplyDraft({
      channel: "whatsapp",
      clientName: "Fake A",
      customerQuestion: "Can I deposit USDT?",
      replies: ["Yes, please use the wallet shown in your account."],
      provider: "deepseek",
      source: "reply_agent",
      notify: false,
    });
    const second = await storePendingReplyDraft({
      channel: "wechat",
      clientName: "Fake B",
      customerQuestion: "Where do I upload KYC?",
      replies: ["Please use the onboarding form we emailed you."],
      provider: "deepseek",
      source: "auto_reply",
      notify: false,
    });

    const approved = await reviewReplyDraft({
      id: first!.id,
      decision: "approved",
      decidedBy: "kayden",
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.draft.status).toBe("approved");
    expect(approved.draft.decidedBy).toBe("kayden");
    expect(approved.deliveredToClient).toBe(false);
    expect(approved.deliveryAllowed).toBe(false);

    const rejected = await reviewReplyDraft({
      id: second!.id,
      decision: "rejected",
      decidedBy: "kayden",
      decisionNote: "Needs a clearer fee explanation",
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.draft.status).toBe("rejected");
    expect(rejected.deliveredToClient).toBe(false);

    const again = await reviewReplyDraft({
      id: first!.id,
      decision: "rejected",
      decidedBy: "kayden",
    });
    expect(again.ok).toBe(false);
  });
});

describe("approver Telegram target", () => {
  it("uses TELEGRAM_APPROVER_CHAT_ID or TELEGRAM_CHAT_ID and does not guess", async () => {
    const { getApproverTelegramChatId } = await import("@/lib/support/draft-approval");
    expect(getApproverTelegramChatId()).toBeNull();

    process.env.TELEGRAM_CHAT_ID = "staff-chat-from-env";
    expect(getApproverTelegramChatId()).toBe("staff-chat-from-env");

    process.env.TELEGRAM_APPROVER_CHAT_ID = "approver-chat-from-env";
    expect(getApproverTelegramChatId()).toBe("approver-chat-from-env");
  });

  it("notifies only the configured staff chat id", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token-not-real";
    process.env.TELEGRAM_CHAT_ID = "kayden-staff-chat";
    sendTelegramMessage.mockResolvedValue({ ok: true });

    const { storePendingReplyDraft } = await import("@/lib/support/draft-approval");
    const draft = await storePendingReplyDraft({
      channel: "web",
      clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
      customerQuestion: "Office hours?",
      replies: ["Weekdays 9-18 Malaysia time."],
      provider: "deepseek",
      source: "reply_agent",
      notify: true,
    });

    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    const [message, chatId] = sendTelegramMessage.mock.calls[0] as [string, string];
    expect(chatId).toBe("kayden-staff-chat");
    expect(message).toContain("Pending reply draft");
    expect(message).toContain("pending approval");
    expect(draft!.notifiedTelegram).toBe(true);
    expect(draft!.telegramError).toBeNull();
  });
});
