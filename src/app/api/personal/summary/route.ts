import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { getFinanceOverview, getPaymentsNeedingReminder } from "@/lib/finance/store";
import { formatCurrency } from "@/lib/utils";
import { listJobs, listPlans, todayDateString } from "@/lib/personal/store";

export async function POST() {
  try {
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

    const lines = [
      "📋 <b>Personal Assistant Summary</b>",
      `📅 ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
      "",
      todayPlan
        ? `<b>Today's Plan:</b> ${todayPlan.title} (${doneItems}/${totalItems} done)`
        : "<b>Today's Plan:</b> Not set yet",
      "",
      `<b>Pending Jobs (${pendingJobs.length}):</b>`,
      ...(pendingJobs.length
        ? pendingJobs.slice(0, 8).map((j) => `• [${j.priority}] ${j.title}`)
        : ["• No pending jobs — all clear!"]),
      "",
      `<b>Finance This Month:</b>`,
      ...finance.currencies.flatMap((c) => [
        `${c.currency}: Income ${formatCurrency(c.income, c.currency)} · Expenses ${formatCurrency(c.expenses, c.currency)} · Net ${formatCurrency(c.net, c.currency)}`,
      ]),
    ];

    if (dueSoon.length > 0) {
      lines.push("", `<b>Payments Due Soon:</b>`);
      for (const p of dueSoon.slice(0, 5)) {
        const amount = p.amount ? formatCurrency(p.amount, p.currency) : "TBD";
        lines.push(`• ${p.title} — ${amount} (${p.daysUntil === 0 ? "today" : `${p.daysUntil}d`})`);
      }
    }

    if (todayPlan?.notes) {
      lines.push("", `<b>Notes:</b> ${todayPlan.notes}`);
    }

    const result = await sendTelegramMessage(lines.join("\n"));
    if (!result.ok) {
      return NextResponse.json({ sent: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("[Personal Summary]", error);
    return NextResponse.json({ error: "Failed to send summary" }, { status: 500 });
  }
}
