import { getCrmOverview } from "@/lib/crm/store";
import { getFinanceOverview, getPaymentsNeedingReminder } from "@/lib/finance/store";
import { listJobs, listPlans, todayDateString } from "@/lib/personal/store";
import { formatCurrency } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/types";
import {
  buildDailyDigestEmail,
  buildFollowUpEmail,
  buildPaymentReminderEmail,
} from "./templates";
import type { EmailTimezone } from "@/types/email";

function formatDateLabel(timezone: EmailTimezone, locale: Locale) {
  return new Date().toLocaleDateString(locale === "zh" ? "zh-CN" : "en-MY", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function paymentWhen(daysUntil: number, locale: Locale) {
  if (locale === "zh") {
    if (daysUntil === 0) return "今天";
    if (daysUntil === 1) return "明天";
    return `${daysUntil} 天后`;
  }
  if (daysUntil === 0) return "TODAY";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
}

export async function buildDailyDigestEmailContent(locale: Locale, timezone: EmailTimezone) {
  const today = todayDateString();
  const [jobs, plans, finance, dueSoon] = await Promise.all([
    listJobs(),
    listPlans(),
    getFinanceOverview(),
    getPaymentsNeedingReminder(),
  ]);

  const pendingJobs = jobs.filter((j) => j.status === "todo" || j.status === "in_progress");
  const todayPlan = plans.find((p) => p.period === "daily" && p.plan_date === today);
  const doneItems = todayPlan?.items.filter((i) => i.done).length ?? 0;
  const totalItems = todayPlan?.items.length ?? 0;

  const planLine =
    locale === "zh"
      ? todayPlan
        ? `计划：${todayPlan.title}（${doneItems}/${totalItems} 已完成）`
        : "计划：尚未设置"
      : todayPlan
        ? `Plan: ${todayPlan.title} (${doneItems}/${totalItems} done)`
        : "Plan: not set yet";

  const financeLines = finance.currencies.map((c) =>
    locale === "zh"
      ? `${c.currency}：收入 ${formatCurrency(c.income, c.currency)} / 支出 ${formatCurrency(c.expenses, c.currency)} / 结余 ${formatCurrency(c.net, c.currency)}`
      : `${c.currency}: +${formatCurrency(c.income, c.currency)} / -${formatCurrency(c.expenses, c.currency)} = ${formatCurrency(c.net, c.currency)}`,
  );

  const paymentLines = dueSoon.slice(0, 8).map((p) => {
    const amount = p.amount ? formatCurrency(p.amount, p.currency) : locale === "zh" ? "待定" : "TBD";
    return `${p.title} — ${amount} (${paymentWhen(p.daysUntil, locale)})`;
  });

  return buildDailyDigestEmail({
    locale,
    timezone,
    dateLabel: formatDateLabel(timezone, locale),
    planLine,
    pendingJobs: pendingJobs.slice(0, 8).map((j) => ({ priority: j.priority, title: j.title })),
    financeLines,
    paymentLines,
    notes: todayPlan?.notes,
  });
}

export async function buildPaymentReminderEmailContent(locale: Locale, timezone: EmailTimezone) {
  const [finance, dueSoon] = await Promise.all([
    getFinanceOverview(),
    getPaymentsNeedingReminder(),
  ]);

  const financeLines = finance.currencies.map((c) =>
    locale === "zh"
      ? `${c.currency}：收入 ${formatCurrency(c.income, c.currency)} / 支出 ${formatCurrency(c.expenses, c.currency)} / 净值 ${formatCurrency(c.net, c.currency)}`
      : `${c.currency}: Income ${formatCurrency(c.income, c.currency)} / Expenses ${formatCurrency(c.expenses, c.currency)} / Net ${formatCurrency(c.net, c.currency)}`,
  );

  const dueRows = dueSoon.map((p) => ({
    title: p.title,
    amount: p.amount ? formatCurrency(p.amount, p.currency) : locale === "zh" ? "待定" : "TBD",
    when: paymentWhen(p.daysUntil, locale),
  }));

  return buildPaymentReminderEmail({ locale, timezone, financeLines, dueSoon: dueRows });
}

export async function buildClientFollowUpDigest(locale: Locale) {
  const overview = await getCrmOverview();
  if (overview.clientsDueToday.length === 0) return null;

  const lines =
    locale === "zh"
      ? overview.clientsDueToday.map(
          (c) => `${c.name} — ${c.lead_status}${c.ib_source ? ` (${c.ib_source})` : ""}`,
        )
      : overview.clientsDueToday.map(
          (c) => `${c.name} — ${c.lead_status}${c.ib_source ? ` · ${c.ib_source}` : ""}`,
        );

  const subject =
    locale === "zh"
      ? `AXPM 客户跟进 — 今日 ${overview.clientsDueToday.length} 位`
      : `AXPM Client Follow-Ups — ${overview.clientsDueToday.length} due today`;

  const text = [subject, "", ...lines.map((l) => `• ${l}`)].join("\n");
  const html = `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;

  return { subject, text, html: `<!DOCTYPE html><html><body>${html}</body></html>` };
}

export function buildSingleFollowUpEmail(
  locale: Locale,
  params: { clientName: string; dueAt: string; notes?: string | null },
) {
  return buildFollowUpEmail({ locale, ...params });
}
