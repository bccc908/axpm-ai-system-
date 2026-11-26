import { roleCanAccessModule, rolesForModule } from "@/lib/auth/permissions";
import type { AuthModule, UserRole } from "@/lib/auth/types";

export const OWNER_ADMIN: readonly UserRole[] = ["owner", "admin"];

export type ApiRule =
  | { prefix: string; kind: "public" }
  | { prefix: string; kind: "api-key" }
  | { prefix: string; kind: "webhook" }
  | { prefix: string; kind: "cron" }
  | { prefix: string; kind: "bridge" }
  | { prefix: string; kind: "cron-or-roles"; roles: readonly UserRole[] }
  | { prefix: string; kind: "roles"; roles: readonly UserRole[] }
  | { prefix: string; kind: "module"; module: AuthModule };

/**
 * Deny-by-default. First match wins after sorting by prefix length.
 * Public sign-up stays on `customer` (overview, fortune, account).
 * Staff roles keep the modules they already have on the dashboard.
 * Desks that were already owner/admin only (market, social, settings, ops,
 * paid AI, system) stay owner/admin. Cron and bridge keys fail closed.
 */
const API_RULES: ApiRule[] = [
  { prefix: "/api/auth/login", kind: "public" },
  { prefix: "/api/auth/logout", kind: "public" },
  { prefix: "/api/auth/setup", kind: "public" },
  { prefix: "/api/auth/signup", kind: "public" },
  { prefix: "/api/auth/me", kind: "public" },
  { prefix: "/api/auth/verify-email", kind: "public" },
  { prefix: "/api/auth/resend-verification", kind: "public" },
  { prefix: "/api/auth/forgot-password", kind: "public" },
  { prefix: "/api/auth/reset-password", kind: "public" },
  { prefix: "/api/public", kind: "public" },
  { prefix: "/api/webhooks", kind: "webhook" },
  { prefix: "/api/v1", kind: "api-key" },

  { prefix: "/api/gold-signals/atas", kind: "bridge" },
  { prefix: "/api/gold-signals/bookmap", kind: "bridge" },
  { prefix: "/api/gold-signals/mt5", kind: "bridge" },
  { prefix: "/api/local/tts", kind: "bridge" },
  { prefix: "/api/local/ppt", kind: "bridge" },
  { prefix: "/api/local/chart-ppt", kind: "bridge" },
  { prefix: "/api/local/search", kind: "bridge" },

  { prefix: "/api/fortune/daily", kind: "cron" },
  { prefix: "/api/gold-signals/daily", kind: "cron" },
  { prefix: "/api/btc-signals/daily", kind: "cron" },
  { prefix: "/api/eth-signals/daily", kind: "cron" },
  { prefix: "/api/hl-signals/daily", kind: "cron" },
  { prefix: "/api/xau-signals/daily", kind: "cron" },
  { prefix: "/api/signals/approvals/poll", kind: "cron" },

  { prefix: "/api/digest", kind: "cron-or-roles", roles: OWNER_ADMIN },
  { prefix: "/api/email/automation", kind: "cron-or-roles", roles: OWNER_ADMIN },
  { prefix: "/api/email/send-digest", kind: "cron-or-roles", roles: OWNER_ADMIN },
  { prefix: "/api/email/send-fortune", kind: "cron-or-roles", roles: OWNER_ADMIN },
  { prefix: "/api/finance/automation", kind: "cron-or-roles", roles: OWNER_ADMIN },
  { prefix: "/api/social/publish", kind: "cron-or-roles", roles: OWNER_ADMIN },
  { prefix: "/api/system/backup", kind: "cron-or-roles", roles: OWNER_ADMIN },
  { prefix: "/api/groktagon/autopilot", kind: "cron-or-roles", roles: OWNER_ADMIN },

  { prefix: "/api/auth/users", kind: "roles", roles: OWNER_ADMIN },
  { prefix: "/api/ai", kind: "roles", roles: OWNER_ADMIN },
  { prefix: "/api/voice", kind: "roles", roles: OWNER_ADMIN },
  { prefix: "/api/local/status", kind: "roles", roles: OWNER_ADMIN },

  { prefix: "/api/account", kind: "module", module: "account" },
  { prefix: "/api/btc-signals", kind: "module", module: "market" },
  { prefix: "/api/clients", kind: "module", module: "crm" },
  { prefix: "/api/conversations", kind: "module", module: "conversations" },
  { prefix: "/api/crm", kind: "module", module: "crm" },
  { prefix: "/api/douyin", kind: "module", module: "social" },
  { prefix: "/api/email", kind: "module", module: "email" },
  { prefix: "/api/eth-signals", kind: "module", module: "market" },
  { prefix: "/api/finance", kind: "module", module: "finance" },
  { prefix: "/api/fortune", kind: "module", module: "fortune" },
  { prefix: "/api/gold-signals", kind: "module", module: "market" },
  { prefix: "/api/gold-spread", kind: "module", module: "market" },
  { prefix: "/api/groktagon", kind: "module", module: "market" },
  { prefix: "/api/hl-signals", kind: "module", module: "market" },
  { prefix: "/api/inbox", kind: "module", module: "conversations" },
  { prefix: "/api/integrations", kind: "module", module: "finance" },
  { prefix: "/api/knowledge-base", kind: "module", module: "knowledge" },
  { prefix: "/api/liquidity", kind: "module", module: "market" },
  { prefix: "/api/ops-floor", kind: "module", module: "ops" },
  { prefix: "/api/personal/todos", kind: "module", module: "todos" },
  { prefix: "/api/personal", kind: "module", module: "assistant" },
  { prefix: "/api/reminders", kind: "module", module: "reminders" },
  { prefix: "/api/settings", kind: "module", module: "settings" },
  { prefix: "/api/social", kind: "module", module: "social" },
  { prefix: "/api/support", kind: "module", module: "conversations" },
  { prefix: "/api/system", kind: "module", module: "settings" },
  { prefix: "/api/tasks", kind: "module", module: "crm" },
  { prefix: "/api/team", kind: "module", module: "team" },
  { prefix: "/api/telegram", kind: "module", module: "settings" },
  { prefix: "/api/usdt", kind: "module", module: "finance" },
  { prefix: "/api/wechat-work", kind: "module", module: "conversations" },
  { prefix: "/api/whatsapp", kind: "module", module: "whatsapp" },
  { prefix: "/api/xau-signals", kind: "module", module: "market" },
  { prefix: "/api/xiaohongshu", kind: "module", module: "social" },
];

const RULES_BY_LENGTH = [...API_RULES].sort((a, b) => b.prefix.length - a.prefix.length);

export function matchApiRule(pathname: string): ApiRule | null {
  const path = pathname.split("?")[0] || pathname;
  for (const rule of RULES_BY_LENGTH) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) return rule;
  }
  return null;
}

export function rolesForRule(rule: ApiRule): readonly UserRole[] | null {
  if (rule.kind === "roles" || rule.kind === "cron-or-roles") return rule.roles;
  if (rule.kind === "module") return rolesForModule(rule.module);
  return null;
}

export type AccessDecision =
  | { allow: true; rule: ApiRule }
  | { allow: false; status: 401 | 403; error: string; rule: ApiRule | null };

export function decideApiAccess(input: {
  pathname: string;
  role: UserRole | null;
  cronAuthorized: boolean;
  bridgeAuthorized: boolean;
}): AccessDecision {
  const rule = matchApiRule(input.pathname);
  if (!rule) {
    if (!input.role) return { allow: false, status: 401, error: "Unauthorized", rule: null };
    return { allow: false, status: 403, error: "Forbidden", rule: null };
  }

  switch (rule.kind) {
    case "public":
    case "api-key":
    case "webhook":
      return { allow: true, rule };
    case "cron":
      if (!input.cronAuthorized) return { allow: false, status: 401, error: "Unauthorized", rule };
      return { allow: true, rule };
    case "bridge":
      if (!input.bridgeAuthorized) return { allow: false, status: 401, error: "Unauthorized", rule };
      return { allow: true, rule };
    case "cron-or-roles":
      if (input.cronAuthorized) return { allow: true, rule };
      return sessionDecision(input.role, rule.roles, rule);
    case "roles":
      return sessionDecision(input.role, rule.roles, rule);
    case "module":
      if (!input.role) return { allow: false, status: 401, error: "Unauthorized", rule };
      if (!roleCanAccessModule(input.role, rule.module)) {
        return { allow: false, status: 403, error: "Forbidden", rule };
      }
      return { allow: true, rule };
    default:
      return { allow: false, status: 403, error: "Forbidden", rule };
  }
}

function sessionDecision(
  role: UserRole | null,
  roles: readonly UserRole[],
  rule: ApiRule,
): AccessDecision {
  if (!role) return { allow: false, status: 401, error: "Unauthorized", rule };
  if (!roles.includes(role)) return { allow: false, status: 403, error: "Forbidden", rule };
  return { allow: true, rule };
}

export function describeRule(rule: ApiRule): string {
  switch (rule.kind) {
    case "public":
      return "public";
    case "api-key":
      return "public edge; customer API key checked by the handler";
    case "webhook":
      return "public webhook";
    case "cron":
      return "cron (CRON_SECRET required; unset rejects)";
    case "bridge":
      return "bridge (LOCAL_API_KEY required; unset rejects)";
    case "cron-or-roles":
      return `cron (CRON_SECRET) or ${rule.roles.join(", ")}`;
    case "roles":
      return rule.roles.join(", ");
    case "module":
      return `${rolesForModule(rule.module).join(", ")} (${rule.module})`;
    default:
      return "deny";
  }
}

export function apiRoutePathFromFile(file: string): string {
  return (
    "/" +
    file
      .replace(/\\/g, "/")
      .replace(/^src\/app\//, "")
      .replace(/\/route\.ts$/, "")
      .replace(/\[[^\]]+\]/g, "x")
  );
}
