"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bot,
  Brain,
  Camera,
  CreditCard,
  CheckSquare,
  FolderOpen,
  Kanban,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Settings,
  Share2,
  Sparkles,
  Wallet,
  Coins,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

type NavSection = {
  labelKey: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    labelKey: "nav.sectionOps",
    items: [
      { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard },
      { href: "/dashboard/todos", labelKey: "nav.todos", icon: CheckSquare },
      { href: "/dashboard/my-assistant", labelKey: "nav.myAssistant", icon: NotebookPen },
      { href: "/dashboard/finance", labelKey: "nav.finance", icon: Wallet },
      { href: "/dashboard/usdt", labelKey: "nav.usdt", icon: Coins },
      { href: "/dashboard/finance?tab=receipts", labelKey: "nav.receipts", icon: Camera },
      { href: "/dashboard/google-drive", labelKey: "nav.googleDrive", icon: FolderOpen },
    ],
  },
  {
    labelKey: "nav.sectionAi",
    items: [
      { href: "/dashboard/fortune", labelKey: "nav.fortune", icon: Sparkles },
      { href: "/dashboard/market-ai", labelKey: "nav.marketAi", icon: Brain },
      { href: "/dashboard/gold-signals", labelKey: "nav.goldSignals", icon: TrendingUp },
    ],
  },
  {
    labelKey: "nav.sectionClients",
    items: [
      { href: "/dashboard/crm", labelKey: "nav.customerHub", icon: Kanban },
    ],
  },
  {
    labelKey: "nav.sectionMarketing",
    items: [
      { href: "/dashboard/social-media", labelKey: "nav.socialMedia", icon: Share2 },
      { href: "/dashboard/automation", labelKey: "nav.automation", icon: Zap },
    ],
  },
  {
    labelKey: "nav.sectionSystem",
    items: [
      { href: "/dashboard/account", labelKey: "nav.account", icon: CreditCard },
      { href: "/dashboard/team", labelKey: "nav.team", icon: Bot },
      { href: "/dashboard/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const { user, canHref, logout } = useAuth();

  function isActive(href: string) {
    const [path, query] = href.split("?");
    if (path.startsWith("/dashboard/crm")) {
      return (
        pathname.startsWith("/dashboard/crm") ||
        pathname.startsWith("/dashboard/clients") ||
        pathname.startsWith("/dashboard/conversations") ||
        pathname.startsWith("/dashboard/reminders") ||
        pathname.startsWith("/dashboard/email") ||
        pathname.startsWith("/dashboard/whatsapp") ||
        pathname.startsWith("/dashboard/ai-assistant")
      );
    }
    if (path.startsWith("/dashboard/conversations")) {
      return (
        pathname.startsWith("/dashboard/conversations") ||
        pathname.startsWith("/dashboard/ai-assistant")
      );
    }
    if (path === "/dashboard/finance") {
      const tab = searchParams.get("tab");
      const expectedTab = query ? new URLSearchParams(query).get("tab") : null;
      if (!pathname.startsWith("/dashboard/finance")) return false;
      if (expectedTab) return tab === expectedTab;
      return tab !== "receipts";
    }
    return pathname === path || (path !== "/dashboard" && pathname.startsWith(path));
  }

  return (
    <aside className="flex h-full w-[17rem] flex-col border-r border-white/[0.06] bg-[#08080c]/90 backdrop-blur-xl">
      <div className="relative border-b border-white/[0.06] px-5 py-6">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent"
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
          {t("app.brand")}
        </p>
        <h1 className="font-display mt-1 text-lg font-semibold tracking-tight text-foreground">
          {t("app.title")}
        </h1>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {navSections.map((section) => {
          const items = section.items.filter(({ href }) => canHref(href));
          if (items.length === 0) return null;

          return (
            <div key={section.labelKey}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted/80">
                {t(section.labelKey)}
              </p>
              <div className="space-y-0.5">
                {items.map(({ href, labelKey, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href as Route}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        active
                          ? "nav-pill-active"
                          : "text-muted hover:bg-white/[0.04] hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <span
                          className="sidebar-glow-line absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full"
                          aria-hidden
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-accent" : "text-muted group-hover:text-foreground",
                        )}
                        strokeWidth={active ? 2 : 1.75}
                      />
                      {t(labelKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-white/[0.06] p-4">
        {user ? (
          <div className="glass-panel rounded-xl px-3 py-3">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="mt-1 text-xs font-medium text-accent">
              {ROLE_LABELS[user.role][locale === "zh" ? "zh" : "en"]}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2.5 text-sm text-muted transition-colors hover:border-white/15 hover:bg-white/[0.04] hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </button>
        <LanguageSwitcher />
        <p className="text-center text-[10px] text-muted/70">{t("app.version")}</p>
      </div>
    </aside>
  );
}
