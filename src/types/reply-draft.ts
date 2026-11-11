import type { Channel } from "@/types/database";

export type ReplyDraftStatus = "pending_approval" | "approved" | "rejected";

export type ReplyDraftSource = "reply_agent" | "auto_reply" | "web_widget";

export interface ReplyDraft {
  id: string;
  status: ReplyDraftStatus;
  channel: Channel;
  clientName: string;
  clientId: string | null;
  customerQuestion: string;
  conversationHistory: string | null;
  draftReply: string;
  alternatives: string[];
  provider: string;
  fallback: boolean;
  notice: string | null;
  source: ReplyDraftSource;
  /** True only when a notice was posted to the configured staff/approver chat. */
  notifiedTelegram: boolean;
  telegramError: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

export interface ReplyDraftData {
  drafts: ReplyDraft[];
}
