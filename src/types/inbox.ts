import type { Channel } from "@/types/database";

export type InboxSessionStatus = "bot" | "human" | "closed";

export interface InboxSession {
  id: string;
  session_key: string;
  client_id: string | null;
  client_name: string;
  wechat_id: string | null;
  channel: Channel;
  status: InboxSessionStatus;
  assigned_to: string | null;
  last_message_at: string;
  last_preview: string;
  message_count: number;
  unread_count: number;
  created_at: string;
  updated_at: string;
  handoff_at: string | null;
  closed_at: string | null;
}

export interface InboxAnalytics {
  totalSessions: number;
  openSessions: number;
  botSessions: number;
  humanSessions: number;
  closedSessions: number;
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  aiReplies: number;
  humanReplies: number;
  automationRate: number;
  channels: Record<string, number>;
}
