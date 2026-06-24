import { getFinanceOverview, getPaymentsNeedingReminder } from "@/lib/finance/store";
import { listJobs, listPlans, todayDateString } from "@/lib/personal/store";
import { getCrmOverview } from "@/lib/crm/store";
import { formatCurrency } from "@/lib/utils";

export async function buildDailyDigestMessage(
  financeAuto?: {
    applied: number;
    payments: { title: string; paid: number; currency: string; newBalance: number }[];
  },
) {
  const today = todayDateString();
  const [jobs, plans, finance, dueSoon, crm] = await Promise.all([
    listJobs(),
    listPlans(),
    getFinanceOverview(),
    getPaymentsNeedingReminder(),
    getCrmOverview(),
  ]);

  const pendingJobs = jobs.filter((j) => j.status === "todo" || j.status === "in_progress");
  const todayPlan = plans.find((p) => p.period === "daily" && p.plan_date === today);
  const doneItems = todayPlan?.items.filter((i) => i.done).length ?? 0;
  const totalItems = todayPlan?.items.length ?? 0;

  const lines = [
    "📋 <b>AXPM Daily Digest</b>",
    `📅 ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
    "",
    "<b>My Assistant</b>",
    todayPlan
      ? `Plan: ${todayPlan.title} (${doneItems}/${totalItems} done)`
      : "Plan: not set yet",
    `Pending jobs: ${pendingJobs.length}`,
    ...(pendingJobs.length
      ? pendingJobs.slice(0, 5).map((j) => `• [${j.priority}] ${j.title}`)
      : ["• All clear!"]),
  ];

  lines.push("", "<b>Finance This Month</b>");
  for (const c of finance.currencies) {
    lines.push(
      `${c.currency}: +${formatCurrency(c.income, c.currency)} / -${formatCurrency(c.expenses, c.currency)} = ${formatCurrency(c.net, c.currency)}`,
    );
  }

  if (financeAuto && financeAuto.applied > 0) {
    lines.push("", `<b>Auto payments applied (${financeAuto.applied})</b>`);
    for (const p of financeAuto.payments) {
      lines.push(
        `• ${p.title} — paid ${formatCurrency(p.paid, p.currency)} (balance ${formatCurrency(p.newBalance, p.currency)})`,
      );
    }
  }

  if (dueSoon.length > 0) {
    lines.push("", `<b>Payments Due Soon (${dueSoon.length})</b>`);
    for (const p of dueSoon.slice(0, 5)) {
      const amount = p.amount ? formatCurrency(p.amount, p.currency) : "TBD";
      const when =
        p.daysUntil === 0 ? "TODAY" : p.daysUntil === 1 ? "tomorrow" : `${p.daysUntil}d`;
      lines.push(`• ${p.title} — ${amount} (${when})`);
    }
  }

  if (crm.followUpsDueToday > 0) {
    lines.push("", `<b>CRM — Follow up today (${crm.followUpsDueToday})</b>`);
    for (const c of crm.clientsDueToday.slice(0, 5)) {
      const deposit =
        c.deposit_amount > 0 ? ` · ${formatCurrency(c.deposit_amount, "MYR")}` : "";
      lines.push(`• ${c.name} (${c.lead_status})${deposit}`);
    }
  } else if (crm.totalClients > 0) {
    lines.push("", `<b>CRM</b>`, `• ${crm.totalClients} clients · no follow-ups due today`);
  }

  if (todayPlan?.notes) {
    lines.push("", `<b>Notes:</b> ${todayPlan.notes}`);
  }

  return lines.join("\n");
}
