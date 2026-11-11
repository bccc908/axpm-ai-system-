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
  Hexagon,
  Kanban,
  Building2,
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
import { BrandLogo } from "@/components/layout/brand-logo";
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
      { href: "/dashboard/ops-floor", labelKey: "nav.opsFloor", icon: Building2 },
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
      { href: "/dashboard/groktagon", labelKey: "nav.groktagon", icon: Hexagon },
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
    <aside className="flex h-full w-60 flex-col border-r border-card-border bg-surface">
      <div className="flex h-14 items-center gap-3 border-b border-card-border px-4">
        <BrandLogo height={20} />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase leading-4 tracking-[0.06em] text-muted">
            {t("app.title").replace(t("app.brand"), "").replace(/^[\s·\-–—|]+/, "") || t("app.title")}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {navSections.map((section) => {
          const items = section.items.filter(({ href }) => canHref(href));
          if (items.length === 0) return null;

          return (
            <div key={section.labelKey}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted/70">
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
                        "group relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] font-medium transition-colors duration-150",
                        active
                          ? "nav-pill-active"
                          : "text-muted hover:bg-surface-2 hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <span
                          className="sidebar-glow-line absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r"
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

      <div className="space-y-2 border-t border-card-border p-3">
        {user ? (
          <div className="flex items-center gap-2.5 rounded-md border border-card-border bg-background px-2.5 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-foreground">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
            <p className="truncate text-[13px] font-medium leading-4 text-foreground">{user.name}</p>
            <p className="truncate text-[11px] leading-4 text-muted">{user.email}</p>
            <p className="text-[11px] font-medium text-muted">
              {ROLE_LABELS[user.role][locale === "zh" ? "zh" : "en"]}
            </p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </button>
        <LanguageSwitcher />
        <p className="px-3 text-[11px] text-muted/60">{t("app.version")}</p>
      </div>
    </aside>
  );
}
