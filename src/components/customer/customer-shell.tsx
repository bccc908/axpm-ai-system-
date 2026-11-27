"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Brain, CreditCard, LayoutGrid, LogOut, Menu, Sparkles, TrendingUp, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import type { Locale } from "@/lib/i18n";

const NAV = [
  { href: "/dashboard", key: "nav.overview", icon: LayoutGrid, gold: false },
  { href: "/dashboard/fortune", key: "nav.fortune", icon: Sparkles, gold: false, section: "ai" },
  { href: "/dashboard/market-ai", key: "nav.marketAi", icon: Brain, gold: false, section: "ai" },
  { href: "/dashboard/gold-signals", key: "nav.goldSignals", icon: TrendingUp, gold: true, section: "ai" },
  { href: "/dashboard/account", key: "nav.account", icon: CreditCard, gold: false, section: "account" },
] as const;

function docKey(pathname: string) {
  if (pathname.startsWith("/dashboard/fortune")) return "customerAi.docFortune";
  if (pathname.startsWith("/dashboard/market-ai")) return "customerAi.docMarket";
  if (pathname.startsWith("/dashboard/gold-signals")) return "customerAi.docGold";
  if (pathname.startsWith("/dashboard/account")) return "customerAi.docAccount";
  return "customerAi.docOverview";
}

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useLocale();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const name = user?.name?.trim() || "Jamie";
  const initial = name.slice(0, 1).toUpperCase();

  useEffect(() => {
    document.title = t(docKey(pathname));
  }, [pathname, t, locale]);

  function active(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function LangPills({ compact = false }: { compact?: boolean }) {
    const options: { value: Locale; label: string }[] = [
      { value: "en", label: compact ? "EN" : t("lang.en") },
      { value: "zh", label: t("lang.zh") },
    ];
    return (
      <div className="cq-pills" role="group" aria-label={t("lang.switch")}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={locale === opt.value ? "cq-pill is-active" : "cq-pill"}
            aria-pressed={locale === opt.value}
            onClick={() => setLocale(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    const overview = NAV.filter((item) => !("section" in item));
    const ai = NAV.filter((item) => "section" in item && item.section === "ai");
    const account = NAV.filter((item) => "section" in item && item.section === "account");
    const render = (items: typeof NAV[number][]) =>
      items.map((item) => {
        const Icon = item.icon;
        const on = active(item.href);
        return (
          <Link
            key={item.href}
            href={item.href as Route}
            className={on ? "cq-link is-active" : "cq-link"}
            aria-current={on ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon className={item.gold ? "cq-gold" : undefined} strokeWidth={on ? 2 : 1.75} aria-hidden />
            <span>{t(item.key)}</span>
          </Link>
        );
      });
    return (
      <nav className="cq-nav" aria-label={t("customerAi.role")}>
        {render(overview)}
        <p className="cq-section">{t("nav.sectionAi")}</p>
        {render(ai)}
        <p className="cq-section">{t("nav.sectionSystem")}</p>
        {render(account)}
      </nav>
    );
  }

  return (
    <div className={open ? "customer-quiet nav-open flex h-[100dvh] overflow-hidden" : "customer-quiet flex h-[100dvh] overflow-hidden"} data-locale={locale}>
      <button type="button" className="cq-backdrop" aria-label={t("customerAi.closeMenu")} onClick={() => setOpen(false)} />
      <aside className="cq-sidebar">
        <div className="cq-brand">
          <p className="cq-wordmark">KD</p>
        </div>
        <NavLinks onNavigate={() => setOpen(false)} />
        <div className="cq-foot">
          <LangPills />
          <div className="cq-user">
            <span className="cq-avatar" aria-hidden>{initial}</span>
            <div>
              <div className="cq-user-name">{name}</div>
              <div className="cq-user-role">{t("customerAi.role")}</div>
            </div>
            <button type="button" className="cq-signout" aria-label={t("auth.logout")} onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="cq-main">
        <header className="cq-topbar">
          <button type="button" className="cq-icon-btn" aria-label={open ? t("customerAi.closeMenu") : t("customerAi.menu")} onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <p className="cq-wordmark">KD</p>
          <LangPills compact />
          <span className="cq-avatar" aria-hidden>{initial}</span>
        </header>
        <main className="cq-content">
          <div className="cq-page">{children}</div>
        </main>
        <nav className="cq-bottom" aria-label={t("customerAi.role")}>
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = active(item.href);
            return (
              <Link key={item.href} href={item.href as Route} className={on ? "is-active" : undefined} aria-current={on ? "page" : undefined}>
                <Icon className={item.gold ? "cq-gold" : undefined} strokeWidth={on ? 2 : 1.75} aria-hidden />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
