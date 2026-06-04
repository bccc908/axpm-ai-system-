import type {
  Client,
  ConversationSummary,
  DailyReport,
  FollowUp,
  Reminder,
  TeamMember,
  TeamTask,
} from "@/types/database";

export interface CrmData {
  clients: Client[];
  followUps: FollowUp[];
  teamMembers: TeamMember[];
  tasks: TeamTask[];
  reminders: Reminder[];
  conversationSummaries: ConversationSummary[];
  dailyReports: DailyReport[];
}

export interface CrmOverview {
  totalClients: number;
  followUpsDueToday: number;
  totalDeposits: number;
  pendingTasks: number;
  clientsDueToday: Client[];
  recentFollowUps: FollowUp[];
  latestDailyReport: DailyReport | null;
}
