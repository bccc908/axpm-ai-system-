export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "negotiating"
  | "deposited"
  | "active"
  | "dormant"
  | "lost";

export type Channel = "whatsapp" | "wechat" | "telegram" | "email" | "phone" | "web";

export type ReminderChannel = "telegram" | "whatsapp";

export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  wechat: string | null;
  lead_status: LeadStatus;
  deposit_amount: number;
  deposit_currency: string;
  ib_source: string | null;
  tags: string[];
  assigned_to: string | null;
  notes: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  client_id: string;
  team_member_id: string | null;
  channel: Channel;
  summary: string | null;
  notes: string;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "agent";
  telegram_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Reminder {
  id: string;
  client_id: string | null;
  team_member_id: string | null;
  title: string;
  message: string;
  channel: ReminderChannel;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
}

export interface TeamTask {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  client_id?: string | null;
  deal_id?: string | null;
  status: TaskStatus;
  due_at: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  client_id: string;
  channel: Channel;
  summary: string;
  recommendations: string[];
  created_at: string;
}

export interface DailyReport {
  id: string;
  report_date: string;
  content: string;
  metrics: Record<string, number>;
  created_at: string;
}
