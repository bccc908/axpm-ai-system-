import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const tempDirs: string[] = [];

async function useTempDraftFile() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "axpm-ai-send-gate-"));
  tempDirs.push(dir);
  process.env.AXPM_REPLY_DRAFTS_FILE = path.join(dir, "reply-drafts.json");
  return process.env.AXPM_REPLY_DRAFTS_FILE;
}

beforeEach(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_APPROVER_CHAT_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WECHAT_WORK_CORP_ID;
  delete process.env.WECHAT_WORK_SECRET;
  await useTempDraftFile();
});

afterEach(async () => {
  delete process.env.AXPM_REPLY_DRAFTS_FILE;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("rejectIfAiDraftText and low-level send helpers", () => {
  it("blocks exact AI draft text and allows a different manual message", async () => {
    const { storePendingReplyDraft } = await import("@/lib/support/draft-approval");
    const { rejectIfAiDraftText } = await import("@/lib/support/client-send-gate");

    const draft = await storePendingReplyDraft({
      channel: "whatsapp",
      clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
      customerQuestion: "Office hours?",
      replies: [
        "Our team is available 9:00-18:00 Malaysia time on weekdays.",
        "Alternative hours reply",
      ],
      provider: "deepseek",
      source: "inbox",
      notify: false,
    });
    expect(draft).not.toBeNull();

    const blockedMain = await rejectIfAiDraftText(draft!.draftReply);
    expect(blockedMain.blocked).toBe(true);
    if (blockedMain.blocked) {
      expect(blockedMain.draftId).toBe(draft!.id);
      expect(blockedMain.status).toBe("pending_approval");
      expect(blockedMain.error).toMatch(/AI draft/);
    }

    const blockedAlt = await rejectIfAiDraftText("Alternative hours reply");
    expect(blockedAlt.blocked).toBe(true);

    const allowed = await rejectIfAiDraftText("I'll call you at 3pm as we agreed.");
    expect(allowed.blocked).toBe(false);
  });

  it("sendWhatsAppMessageDetailed refuses AI draft text before calling Meta", async () => {
    const { storePendingReplyDraft } = await import("@/lib/support/draft-approval");
    const { sendWhatsAppMessageDetailed } = await import("@/lib/integrations/whatsapp");

    const draft = await storePendingReplyDraft({
      channel: "whatsapp",
      clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
      customerQuestion: "Can I deposit?",
      replies: ["Please use the wallet shown in your account."],
      provider: "fallback",
      source: "inbox",
      notify: false,
    });

    const blocked = await sendWhatsAppMessageDetailed(
      "15550001111",
      draft!.draftReply,
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/AI draft/);
    }

    const manual = await sendWhatsAppMessageDetailed(
      "15550001111",
      "Manual staff note: please call the desk.",
    );
    expect(manual.ok).toBe(false);
    if (!manual.ok) {
      expect(manual.error).not.toMatch(/AI draft/);
      expect(manual.error).toMatch(/WHATSAPP_ACCESS_TOKEN/);
    }
  });

  it("sendWeChatWorkMessage refuses AI draft text before calling WeChat", async () => {
    const { storePendingReplyDraft } = await import("@/lib/support/draft-approval");
    const { sendWeChatWorkMessage } = await import("@/lib/integrations/wechat-work");

    const draft = await storePendingReplyDraft({
      channel: "wechat",
      clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
      customerQuestion: "KYC?",
      replies: ["Please use the onboarding form we emailed you."],
      provider: "fallback",
      source: "inbox",
      notify: false,
    });

    const blocked = await sendWeChatWorkMessage({
      external_userid: "wo-fake",
      content: draft!.draftReply,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/AI draft/);
    }
  });

  it("deliverAgentReply blocks AI text and still allows a unique manual send on web", async () => {
    vi.resetModules();
    const createMessage = vi.fn(async (input: Record<string, unknown>) => ({
      id: "msg-manual",
      ...input,
    }));
    vi.doMock("@/lib/crm/store", () => ({
      listClients: async () => [
        {
          id: "client-1",
          name: "AUDIT_FAKE_CLIENT_NOT_REAL",
          whatsapp: "15550001111",
          wechat: null,
        },
      ],
    }));
    vi.doMock("@/lib/conversations/store", () => ({ createMessage }));

    const { storePendingReplyDraft } = await import("@/lib/support/draft-approval");
    const { deliverAgentReply } = await import("@/lib/inbox/deliver-reply");

    const draft = await storePendingReplyDraft({
      channel: "web",
      clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
      clientId: "client-1",
      customerQuestion: "Hours?",
      replies: ["Weekdays 9-18 Malaysia time."],
      provider: "fallback",
      source: "inbox",
      notify: false,
    });

    const session = {
      id: "sess-1",
      client_id: "client-1",
      client_name: "AUDIT_FAKE_CLIENT_NOT_REAL",
      channel: "web" as const,
      wechat_id: null,
    };

    const blocked = await deliverAgentReply({
      session: session as never,
      content: draft!.draftReply,
      senderLabel: "Agent",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/AI draft/);
    }
    expect(createMessage).not.toHaveBeenCalled();

    const manual = await deliverAgentReply({
      session: session as never,
      content: "Thanks — I'll look this up and email you today.",
      senderLabel: "Agent",
    });
    expect(manual.ok).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(1);
  });
});

describe("legacy reply 402 handling", () => {
  it("isInsufficientLlmBalance detects 402 and insufficient balance", async () => {
    const { isInsufficientLlmBalance } = await import("@/lib/ai/client");
    expect(isInsufficientLlmBalance(new Error("402 Insufficient Balance"))).toBe(true);
    expect(
      isInsufficientLlmBalance(
        new Error("Insufficient Balance — top up at platform.deepseek.com"),
      ),
    ).toBe(true);
    expect(isInsufficientLlmBalance(new Error("rate limit 429"))).toBe(false);
  });

  it("generateReplySuggestionSafe returns fallback suggestions instead of throwing on 402", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ai/client", async () => {
      const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
      return {
        ...actual,
        getOpenAI: () => ({
          chat: {
            completions: {
              create: async () => {
                throw new Error("402 Insufficient Balance — top up at platform.deepseek.com");
              },
            },
          },
        }),
        getChatModel: () => "deepseek-chat",
        getLlmProvider: () => "deepseek",
        getLlmDisplayName: () => "DeepSeek",
      };
    });

    const { generateReplySuggestionSafe } = await import("@/lib/ai/openai");
    const result = await generateReplySuggestionSafe({
      channel: "web",
      clientName: "AUDIT_FAKE_CLIENT_NOT_REAL",
      context: "General follow-up",
    });
    expect(result.fallback).toBe(true);
    expect(result.provider).toBe("fallback");
    expect(result.notice).toMatch(/Insufficient Balance/);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
