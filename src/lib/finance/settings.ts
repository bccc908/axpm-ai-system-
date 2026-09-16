import fs from "fs/promises";
import path from "path";
import { currentMonthKey } from "@/lib/finance/helpers";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

export type AppSettings = {
  digestHour?: number;
  defaultFinanceCurrency?: string;
  /** When true (default): auto-link, auto-reminders, auto-deduct on due day, receipt expenses */
  financeAutoMode?: boolean;
  /** First month to track (YYYY-MM). Auto-pay and reports start from this month. */
  financeStartMonth?: string;
  /** Send new to-do to Telegram (default true when bot configured) */
  todoNotifyTelegram?: boolean;
  /** Send new to-do to WhatsApp (default true when phone set) */
  todoNotifyWhatsapp?: boolean;
  /** Your mobile number for WhatsApp alerts e.g. +60123456789 */
  whatsappNotifyPhone?: string | null;
  /** Extra instructions for Customer Reply Agent (appended to default conversion playbook) */
  replyAgentPrompt?: string | null;
  /** Persona / style prompt for social media marketing (Douyin copy + video) */
  socialMarketingPrompt?: string | null;
  /** Edge TTS voice id e.g. zh-CN-YunxiNeural */
  presenterEdgeVoice?: string | null;
  /** macOS say voice e.g. Meijia */
  presenterMacVoice?: string | null;
  /** piper = self-hosted, edge = online, mac = macOS say, minimax = cloud API, auto = own engines first */
  presenterTtsPriority?: "piper" | "minimax" | "edge" | "mac" | "auto" | null;
  /** Auto-create CRM client from WeChat Work / WhatsApp / inbound chat (default true) */
  autoCreateClientsFromChat?: boolean;
  /** Telegram alert when a new client is auto-created or registers */
  notifyNewClientTelegram?: boolean;
  /** Telegram alert when a customer sends a new inbound message */
  notifyInboundMessageTelegram?: boolean;
  /** Auto-send AI reply when customer messages on WhatsApp / WeChat Work */
  autoReplyEnabled?: boolean;
  autoReplyWhatsApp?: boolean;
  autoReplyWeChat?: boolean;
  /** Website live-chat widget */
  widgetEnabled?: boolean;
  widgetTitle?: string | null;
  widgetSubtitle?: string | null;
  widgetWelcomeMessage?: string | null;
  widgetPrimaryColor?: string | null;
  widgetButtonLabel?: string | null;
  /** Round-robin assign website widget leads to team members */
  crmWidgetAutoAssign?: boolean;
  crmAssignmentIndex?: number;
  crmWorkflows?: import("@/types/crm-workflows").CrmWorkflow[];
  /** Send Telegram when CRM workflow rules fire (default true) */
  crmWorkflowNotifyTelegram?: boolean;
  /** Read-only Hyperliquid wallet (0x…) */
  hyperliquidAddress?: string | null;
};

export async function readAppSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw) as AppSettings;
  } catch {
    return {};
  }
}

export async function writeAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readAppSettings();
  const next = { ...current, ...patch };
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2));
  return next;
}

/** Defaults to true — user asked for all automatic */
export async function isFinanceAutoMode(): Promise<boolean> {
  const s = await readAppSettings();
  return s.financeAutoMode !== false;
}

export async function getFinanceStartMonth(): Promise<string> {
  const s = await readAppSettings();
  return s.financeStartMonth ?? "2026-06";
}

export function effectiveOverviewMonth(requested?: string, startMonth?: string) {
  const now = currentMonthKey();
  const start = startMonth ?? "2026-06";
  const month = requested ?? now;
  if (month < start) return start;
  return month;
}
