"use client";

import { PLAN_CONFIG } from "@/lib/customer/plans";
import type { ProductSignupList } from "@/lib/customers/product-signups";
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/customer/types";
import { useLocale } from "@/components/providers/locale-provider";

const STATUS_KEYS: Record<SubscriptionStatus, string> = {
  active: "productSignups.statusActive",
  trialing: "productSignups.statusTrialing",
  past_due: "productSignups.statusPastDue",
  canceled: "productSignups.statusCanceled",
};

export function ProductSignupsList({ list }: { list: ProductSignupList }) {
  const { t, locale } = useLocale();
  const language = locale === "zh" ? "zh" : "en";

  function planLabel(plan: SubscriptionPlan | null) {
    if (!plan) return t("productSignups.missing");
    return PLAN_CONFIG[plan]?.label[language] ?? plan;
  }

  function statusLabel(status: SubscriptionStatus | null) {
    if (!status) return t("productSignups.missing");
    return t(STATUS_KEYS[status]);
  }

  return (
    <section className="space-y-6" data-testid="product-signups-list">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Kayden Chiew</p>
        <h1 className="text-2xl font-semibold text-foreground">{t("productSignups.title")}</h1>
        <p className="max-w-3xl text-sm text-muted">{t("productSignups.subtitle")}</p>
      </header>

      <p className="text-sm leading-6 text-foreground" data-testid="product-signups-count">
        {t("productSignups.countLine", {
          all: list.counts.all,
          asOf: list.as_of_display,
          day: list.counts.last_24_hours,
          week: list.counts.last_7_days,
          active: list.counts.active,
        })}
      </p>

      {list.signups.length === 0 ? (
        <p className="rounded-xl border border-card-border bg-card/40 px-4 py-6 text-center text-sm text-muted">
          {t("productSignups.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-card-border">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{t("productSignups.title")}</caption>
            <thead className="border-b border-card-border bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("productSignups.colName")}</th>
                <th className="px-4 py-3 font-medium">{t("productSignups.colEmail")}</th>
                <th className="px-4 py-3 font-medium">{t("productSignups.colSignedUp")}</th>
                <th className="px-4 py-3 font-medium">{t("productSignups.colVerified")}</th>
                <th className="px-4 py-3 font-medium">{t("productSignups.colPlan")}</th>
                <th className="px-4 py-3 font-medium">{t("productSignups.colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("productSignups.colLogin")}</th>
              </tr>
            </thead>
            <tbody>
              {list.signups.map((row) => (
                <tr key={row.id} className="border-b border-card-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{row.name || t("productSignups.missing")}</td>
                  <td className="px-4 py-3 text-foreground">{row.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-foreground">
                    {row.signed_up_at_display ?? t("productSignups.missing")}
                  </td>
                  <td className="px-4 py-3 text-muted">{t("productSignups.verifiedNotBuilt")}</td>
                  <td className="px-4 py-3 text-foreground">{planLabel(row.plan)}</td>
                  <td className="px-4 py-3 text-foreground">{statusLabel(row.account_status)}</td>
                  <td className="px-4 py-3 text-foreground">
                    {row.login_active ? t("productSignups.loginActive") : t("productSignups.loginInactive")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
