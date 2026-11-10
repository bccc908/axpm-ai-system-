export type AgentStatus = "working" | "idle" | "busy" | "error";

export type OpsLocaleText = { en: string; zh: string };

export type SignalDeskId = "gold" | "xau" | "spread" | "btc" | "eth" | "hl";

export type SignalLite = {
  id: string;
  created_at: string;
  symbol: string;
  bias: string;
  spot_price: number | null;
  entry_zone: { low: number; high: number } | null;
  stop_loss: number | null;
  take_profit: number[];
  thesis: string | null;
  expires_at: string | null;
};

export type TodoLite = {
  id: string;
  title: string;
  done: boolean;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type JobLite = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type FollowUpLite = {
  id: string;
  notes: string;
  summary: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type CrmReminderLite = {
  id: string;
  title: string;
  message: string;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
};

export type TeamTaskLite = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  created_at: string;
};

export type BillLite = {
  id: string;
  title: string;
  amount: number | null;
  currency: string;
  due_day: number;
  remind_days_before: number;
  is_active: boolean;
  last_paid_at: string | null;
};

export type ReceiptLite = {
  id: string;
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

export type InboxLite = {
  id: string;
  client_name: string;
  last_preview: string;
  last_message_at: string;
  unread_count: number;
  status: string;
};

export type SocialPostLite = {
  id: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  updated_at: string;
};

export type MarketMessageLite = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  fallback?: boolean;
};

export type GroktagonLite = {
  enabled: boolean;
  last_run_at: string | null;
  last_result: string | null;
  last_fired: boolean;
};

export type BridgePoll = { at: string; ok: boolean };

export type OpsTickerPrice = {
  symbol: "XAUUSD" | "BTCUSD" | "ETHUSD";
  price: number;
  change_pct: number | null;
  source: "live" | "signal" | "demo";
};

export type OpsFloorSources = {
  now: string;
  prices?: OpsTickerPrice[];
  signals: Record<SignalDeskId, SignalLite[]>;
  todos: TodoLite[];
  jobs: JobLite[];
  followUps: FollowUpLite[];
  reminders: CrmReminderLite[];
  tasks: TeamTaskLite[];
  bills: BillLite[];
  receipts: ReceiptLite[];
  inbox: InboxLite[];
  socialPosts: SocialPostLite[];
  marketMessages: MarketMessageLite[];
  groktagon: GroktagonLite | null;
  hyperliquidConfigured: boolean;
  telegramReady: boolean;
  localApiKeyConfigured: boolean;
  socialConfiguredCount: number;
  bridgePolls: Partial<Record<"mt5" | "atas" | "bookmap", BridgePoll>>;
};

export type OpsSignalTip = {
  id: string;
  desk: SignalDeskId;
  name_en: string;
  name_zh: string;
  symbol: string;
  bias: string;
  entry: string | null;
  stop_loss: number | null;
  take_profit: number[];
  time: string | null;
  thesis: string | null;
  href: string;
};

export type ReminderSource =
  | "todo"
  | "job"
  | "crm_reminder"
  | "follow_up"
  | "team_task"
  | "bill";

export type OpsReminderItem = {
  id: string;
  source: ReminderSource;
  title: string;
  detail_en: string;
  detail_zh: string;
  due_at: string | null;
  status: "pending" | "done" | "overdue";
  href: string;
};

export type IntegrationHealth = {
  id: string;
  name_en: string;
  name_zh: string;
  status: "ok" | "idle" | "stale" | "error";
  detail_en: string;
  detail_zh: string;
  last_at: string | null;
};

export type OpsActivityEvent = {
  id: string;
  at: string;
  text_en: string;
  text_zh: string;
  tone: "info" | "ok" | "error";
};

export type OpsAgent = {
  id: string;
  name: string;
  role_en: string;
  role_zh: string;
  task_en: string;
  task_zh: string;
  floor: number;
  status: AgentStatus;
  href: string;
};

export type OpsFloorSummary = {
  live: boolean;
  demo: boolean;
  generated_at: string;
  floors: { index: number; name_en: string; name_zh: string }[];
  agents: OpsAgent[];
  stats: {
    pending_tasks: number;
    done_today: number;
    open_signals: number;
    due_reminders: number;
    agents_working: number;
    agents_busy: number;
    agents_idle: number;
    agents_error: number;
  };
  team_tasks: {
    pending: number;
    in_progress: number;
    done: number;
    cancelled: number;
  };
  signals: OpsSignalTip[];
  reminders: {
    pending: OpsReminderItem[];
    done: OpsReminderItem[];
    overdue: OpsReminderItem[];
  };
  activity: OpsActivityEvent[];
  integrations: IntegrationHealth[];
  prices: OpsTickerPrice[];
};
