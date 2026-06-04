import type { Channel } from "@/types/database";

export type MessageDirection = "inbound" | "outbound";
export type MessageSource =
  | "manual"
  | "import"
  | "wechat_work"
  | "wechat_official"
  | "whatsapp";

export interface ConversationMessage {
  id: string;
  client_id: string | null;
  client_name: string | null;
  wechat_id: string | null;
  channel: Channel;
  direction: MessageDirection;
  sender_label: string;
  content: string;
  source: MessageSource;
  external_id: string | null;
  sent_at: string;
  created_at: string;
}

export interface ConversationData {
  messages: ConversationMessage[];
}

export interface ConversationThread {
  client_id: string | null;
  client_name: string;
  wechat_id: string | null;
  channel: Channel;
  message_count: number;
  last_message_at: string;
  last_preview: string;
}
