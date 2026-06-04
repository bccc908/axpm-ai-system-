"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  Bot,
  Bell,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  Settings,
  Share2,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard },
  { href: "/dashboard/todos", labelKey: "nav.todos", icon: CheckSquare },
  { href: "/dashboard/my-assistant", labelKey: "nav.myAssistant", icon: NotebookPen },
  { href: "/dashboard/finance", labelKey: "nav.finance", icon: Wallet },
  { href: "/dashboard/clients", labelKey: "nav.clients", icon: Users },
  { href: "/dashboard/conversations", labelKey: "nav.conversations", icon: MessagesSquare },
  { href: "/dashboard/ai-assistant", labelKey: "nav.aiAssistant", icon: MessageSquare },
  { href: "/dashboard/reminders", labelKey: "nav.reminders", icon: Bell },
  { href: "/dashboard/automation", labelKey: "nav.automation", icon: Zap },
  { href: "/dashboard/social-media", labelKey: "nav.socialMedia", icon: Share2 },
  { href: "/dashboard/team", labelKey: "nav.team", icon: Bot },
  { href: "/dashboard/settings", labelKey: "nav.settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-card-border bg-card">
      <div className="border-b border-card-border px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          AXPM
        </p>
        <h1 className="mt-0.5 text-base font-bold text-foreground">{t("app.title")}</h1>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ href, labelKey, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:bg-card-border/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-card-border p-4">
        <LanguageSwitcher />
        <p className="text-xs text-muted">{t("app.version")}</p>
      </div>
    </aside>
  );
}
