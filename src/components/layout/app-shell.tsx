"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { InstallAppBanner } from "@/components/layout/install-app-banner";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

const bottomNav = [
  { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard },
  { href: "/dashboard/todos", labelKey: "nav.todos", icon: CheckSquare },
  { href: "/dashboard/finance", labelKey: "nav.finance", icon: Wallet },
  { href: "/dashboard/conversations", labelKey: "nav.conversations", icon: MessageSquare },
  { href: "/dashboard/crm", labelKey: "nav.crm", icon: Users },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { canHref } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileNav = bottomNav.filter(({ href }) => canHref(href));
  const immersive = pathname.startsWith("/dashboard/ops-floor");
  const goldDesk = pathname.startsWith("/dashboard/gold-signals");
  const fillHeight = immersive || goldDesk;

  return (
    <div className="premium-canvas flex h-[100dvh] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label={t("common.cancel")}
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(280px,85vw)] flex-col border-r border-white/[0.08] bg-[#08080c] shadow-2xl">
            <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
              <span className="font-bold text-foreground">{t("app.brand")}</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="p-2 text-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden" onClick={() => setMenuOpen(false)}>
              <Suspense fallback={null}>
                <Sidebar />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-[#08080c]/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-card-border p-2 text-foreground"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="font-display text-sm font-semibold text-gradient-gold">{t("app.title")}</p>
          <LanguageSwitcher className="text-xs" />
        </header>

        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            fillHeight
              ? "overflow-y-auto md:overflow-hidden"
              : "overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0",
          )}
        >
          <div
            className={cn(
              immersive
                ? "flex min-h-full flex-1 flex-col md:h-full md:min-h-0"
                : goldDesk
                  ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                  : "mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8",
            )}
          >
            {fillHeight ? null : <InstallAppBanner />}
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/[0.08] bg-[#08080c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
          {mobileNav.map(({ href, labelKey, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-[4.5rem] truncate">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
