import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { canDeliverDraftToClient, isApprovedForClientSend } from "@/lib/support/client-send-gate";

const srcRoot = path.join(process.cwd(), "src");

function readSrc(rel: string) {
  return readFileSync(path.join(srcRoot, rel), "utf-8");
}

describe("client send gate", () => {
  it("never allows delivering a draft to a client, even after approval", () => {
    expect(isApprovedForClientSend("approved")).toBe(true);
    expect(isApprovedForClientSend("pending_approval")).toBe(false);
    expect(
      canDeliverDraftToClient({ status: "approved", channel: "whatsapp" }),
    ).toBe(false);
    expect(
      canDeliverDraftToClient({ status: "approved", channel: "wechat" }),
    ).toBe(false);
    expect(canDeliverDraftToClient({ status: "approved", channel: "web" })).toBe(false);
    expect(
      canDeliverDraftToClient({ status: "pending_approval", channel: "whatsapp" }),
    ).toBe(false);
  });

  it("/api/ai/reply generates and stores but does not call any client send", () => {
    const src = readSrc("app/api/ai/reply/route.ts");
    expect(src).toContain("storePendingReplyDraft");
    expect(src).not.toMatch(/sendWhatsAppMessage/);
    expect(src).not.toMatch(/sendWeChatWorkMessage/);
    expect(src).not.toMatch(/sendTelegramMessage/);
    expect(src).not.toMatch(/deliverAgentReply/);
    expect(src).not.toMatch(/maybeAutoReply/);
  });

  it("maybeAutoReply no longer sends to WhatsApp or WeChat", () => {
    const src = readSrc("lib/ai/auto-reply.ts");
    expect(src).toContain("storePendingReplyDraft");
    expect(src).toContain("pending_approval");
    expect(src).toContain("sent: false");
    expect(src).not.toMatch(/sendWhatsAppMessage/);
    expect(src).not.toMatch(/sendWeChatWorkMessage/);
    expect(src).not.toMatch(/createMessage\(/);
  });

  it("website widget stores a draft and returns a holding message, not the AI text as a sent reply", () => {
    const src = readSrc("lib/widget/chat-handler.ts");
    expect(src).toContain("storePendingReplyDraft");
    expect(src).toContain("HOLDING_REPLY_TO_VISITOR");
    expect(src).toContain('title: "AI draft pending approval"');
    expect(src).not.toMatch(/title: "AI reply sent"/);
    expect(src).not.toMatch(/sendWhatsAppMessage|sendWeChatWorkMessage/);
  });

  it("reviewReplyDraft cannot import a client send helper", () => {
    const src = readSrc("lib/support/draft-approval.ts");
    expect(src).toContain("canDeliverDraftToClient");
    expect(src).toContain("getApproverTelegramChatId");
    expect(src).not.toMatch(/sendWhatsAppMessage/);
    expect(src).not.toMatch(/sendWeChatWorkMessage/);
    expect(src).not.toMatch(/sendWeChatWorkToClient/);
    expect(src).not.toMatch(/deliverAgentReply/);
    // Staff/approver notify only, and only with getApproverTelegramChatId()
    expect(src).toMatch(/sendTelegramMessage\(formatDraftTelegramNotice\(draft\), chatId\)/);
  });

  it("reply agent UI no longer offers a direct WeChat send", () => {
    const src = readSrc("components/ai/customer-reply-agent.tsx");
    expect(src).not.toMatch(/sendViaWeChatWork/);
    expect(src).not.toMatch(/\/api\/wechat-work\/send/);
    expect(src).toContain("/dashboard/conversations#reply-drafts");
  });
});
