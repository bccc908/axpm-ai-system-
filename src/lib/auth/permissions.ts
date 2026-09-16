import type { AuthModule, UserRole } from "@/lib/auth/types";

/** Dashboard path prefix → permission module */
export const PATH_MODULE: Array<{ prefix: string; module: AuthModule }> = [
  { prefix: "/dashboard/account", module: "account" },
  { prefix: "/dashboard/settings", module: "settings" },
  { prefix: "/dashboard/team", module: "team" },
  { prefix: "/dashboard/market-ai", module: "market" },
  { prefix: "/dashboard/gold-signals", module: "market" },
  { prefix: "/dashboard/social-media", module: "social" },
  { prefix: "/dashboard/automation", module: "automation" },
  { prefix: "/dashboard/reminders", module: "reminders" },
  { prefix: "/dashboard/email", module: "email" },
  { prefix: "/dashboard/whatsapp", module: "whatsapp" },
  { prefix: "/dashboard/conversations", module: "conversations" },
  { prefix: "/dashboard/ai-assistant", module: "conversations" },
  { prefix: "/dashboard/clients", module: "crm" },
  { prefix: "/dashboard/crm", module: "crm" },
  { prefix: "/dashboard/finance", module: "finance" },
  { prefix: "/dashboard/google-drive", module: "finance" },
  { prefix: "/dashboard/usdt", module: "finance" },
  { prefix: "/dashboard/fortune", module: "fortune" },
  { prefix: "/dashboard/my-assistant", module: "assistant" },
  { prefix: "/dashboard/todos", module: "todos" },
  { prefix: "/dashboard", module: "overview" },
];

const ALL_MODULES: AuthModule[] = [
  "overview",
  "todos",
  "assistant",
  "fortune",
  "finance",
  "crm",
  "conversations",
  "reminders",
  "email",
  "whatsapp",
  "automation",
  "social",
  "market",
  "team",
  "settings",
  "account",
];

const ROLE_MODULES: Record<UserRole, AuthModule[]> = {
  owner: ALL_MODULES,
  admin: ALL_MODULES,
  sales: ["overview", "todos", "crm", "conversations", "reminders", "email", "whatsapp", "team"],
  finance: ["overview", "todos", "finance", "email", "whatsapp"],
  personal: ["overview", "todos", "assistant", "fortune"],
  viewer: ["overview", "crm", "conversations"],
  customer: ["overview", "fortune", "account"],
};

export function modulesForRole(role: UserRole): AuthModule[] {
  return ROLE_MODULES[role] ?? ["overview"];
}

export function roleCanAccessModule(role: UserRole, module: AuthModule): boolean {
  return modulesForRole(role).includes(module);
}

export function moduleForPath(pathname: string): AuthModule | null {
  for (const entry of PATH_MODULE) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      return entry.module;
    }
  }
  return pathname.startsWith("/dashboard") ? "overview" : null;
}

export function roleCanAccessPath(role: UserRole, pathname: string): boolean {
  const authModule = moduleForPath(pathname);
  if (!authModule) return true;
  return roleCanAccessModule(role, authModule);
}

export const NAV_MODULE: Record<string, AuthModule> = {
  "/dashboard": "overview",
  "/dashboard/todos": "todos",
  "/dashboard/my-assistant": "assistant",
  "/dashboard/fortune": "fortune",
  "/dashboard/finance": "finance",
  "/dashboard/google-drive": "finance",
  "/dashboard/usdt": "finance",
  "/dashboard/crm": "crm",
  "/dashboard/conversations": "conversations",
  "/dashboard/reminders": "reminders",
  "/dashboard/email": "email",
  "/dashboard/whatsapp": "whatsapp",
  "/dashboard/automation": "automation",
  "/dashboard/social-media": "social",
  "/dashboard/market-ai": "market",
  "/dashboard/gold-signals": "market",
  "/dashboard/team": "team",
  "/dashboard/account": "account",
  "/dashboard/settings": "settings",
};

export const ROLE_LABELS: Record<UserRole, { zh: string; en: string }> = {
  owner: { zh: "所有者", en: "Owner" },
  admin: { zh: "管理员", en: "Admin" },
  sales: { zh: "销售", en: "Sales" },
  finance: { zh: "财务", en: "Finance" },
  personal: { zh: "个人", en: "Personal" },
  viewer: { zh: "只读", en: "Viewer" },
  customer: { zh: "订阅用户", en: "Customer" },
};
