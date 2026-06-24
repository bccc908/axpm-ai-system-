import type {
  Client,
  ConversationSummary,
  DailyReport,
  FollowUp,
  Reminder,
  TeamMember,
  TeamTask,
} from "@/types/database";
import type { CrmActivity, CrmDeal, CrmPipeline } from "@/types/crm-pro";
import type { CrmAccount, CrmLead } from "@/types/crm-zoho";

export interface CrmData {
  clients: Client[];
  followUps: FollowUp[];
  teamMembers: TeamMember[];
  tasks: TeamTask[];
  reminders: Reminder[];
  conversationSummaries: ConversationSummary[];
  dailyReports: DailyReport[];
  activities: CrmActivity[];
  deals: CrmDeal[];
  pipelines: CrmPipeline[];
  leads: CrmLead[];
  accounts: CrmAccount[];
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
