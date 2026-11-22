export const OPS_MODULES = [
  "gold",
  "xau",
  "bridges",
  "btc",
  "eth",
  "grok",
  "followups",
  "reminders",
  "inbox",
  "bills",
  "usdt",
  "receipts",
  "market",
  "social",
  "todos",
  "chief",
  "signals",
  "builder",
  "presentation",
] as const;

export type OpsModule = (typeof OPS_MODULES)[number];

export type OpsRosterSlot = {
  id: string;
  name: string;
  floor: number;
  module: OpsModule;
  role_en: string;
  role_zh: string;
  href: string;
};

/**
 * Floor figures. Departments that already had an honest owner stay on that
 * figure (Pixel = client support, Rex = research, Mira = todos). Chief,
 * Signals, Builder, and Presentation are the departments that had no figure.
 */
export const OPS_ROSTER: OpsRosterSlot[] = [
  { id: "agent-1", name: "Atlas", floor: 1, module: "gold", role_en: "Gold signals", role_zh: "黄金信号", href: "/dashboard/gold-signals?tab=gold" },
  { id: "agent-2", name: "Nova", floor: 1, module: "xau", role_en: "XAUUSDT desk", role_zh: "XAUUSDT 交易台", href: "/dashboard/gold-signals?tab=xau" },
  { id: "agent-3", name: "Orion", floor: 1, module: "bridges", role_en: "MT5 · ATAS · Bookmap", role_zh: "MT5 · ATAS · Bookmap", href: "/dashboard/gold-signals?tab=gold" },
  { id: "agent-4", name: "Lyra", floor: 2, module: "btc", role_en: "BTC signals", role_zh: "BTC 信号", href: "/dashboard/gold-signals?tab=btc" },
  { id: "agent-5", name: "Vega", floor: 2, module: "eth", role_en: "ETH signals", role_zh: "ETH 信号", href: "/dashboard/gold-signals?tab=eth" },
  { id: "agent-6", name: "Echo", floor: 2, module: "grok", role_en: "Groktagon / Hyperliquid", role_zh: "Groktagon / Hyperliquid", href: "/dashboard/groktagon" },
  { id: "agent-7", name: "Juno", floor: 3, module: "followups", role_en: "CRM follow-ups", role_zh: "客户跟进", href: "/dashboard/crm" },
  { id: "agent-8", name: "AH BAO", floor: 3, module: "reminders", role_en: "CRM reminders", role_zh: "客户提醒", href: "/dashboard/reminders" },
  { id: "agent-9", name: "Pixel", floor: 0, module: "inbox", role_en: "Support Manager", role_zh: "客户支持主管", href: "/dashboard/conversations" },
  { id: "agent-10", name: "Sage", floor: 4, module: "bills", role_en: "Bill reminders", role_zh: "账单提醒", href: "/dashboard/finance" },
  { id: "agent-11", name: "Bolt", floor: 4, module: "usdt", role_en: "USDT checker", role_zh: "USDT 查询", href: "/dashboard/usdt" },
  { id: "agent-12", name: "Iris", floor: 4, module: "receipts", role_en: "Receipts", role_zh: "收据", href: "/dashboard/finance?tab=receipts" },
  { id: "agent-13", name: "Rex", floor: 0, module: "market", role_en: "Research", role_zh: "研究", href: "/dashboard/market-ai" },
  { id: "agent-14", name: "Zed", floor: 0, module: "social", role_en: "Social publisher", role_zh: "社媒发布", href: "/dashboard/social-media" },
  { id: "agent-15", name: "Mira", floor: 3, module: "todos", role_en: "Todos & assistant", role_zh: "待办与助理", href: "/dashboard/todos" },
  { id: "agent-16", name: "Chief", floor: 4, module: "chief", role_en: "Chief of Staff", role_zh: "幕僚长", href: "/dashboard/my-assistant" },
  { id: "agent-17", name: "Signals", floor: 1, module: "signals", role_en: "Signals Manager", role_zh: "信号主管", href: "/dashboard/gold-signals" },
  { id: "agent-18", name: "Builder", floor: 4, module: "builder", role_en: "Builder", role_zh: "构建", href: "/dashboard/my-assistant" },
  { id: "agent-19", name: "Presentation", floor: 0, module: "presentation", role_en: "Presentation", role_zh: "演示文稿", href: "/dashboard/market-ai" },
];
