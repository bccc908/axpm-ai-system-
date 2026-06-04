import { NextResponse } from "next/server";
import { sendPaymentReminderEmail } from "@/lib/integrations/email";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { formatCurrency } from "@/lib/utils";
import { getFinanceOverview, getPaymentsNeedingReminder } from "@/lib/finance/store";

export async function POST() {
  try {
    const [overview, dueSoon] = await Promise.all([
      getFinanceOverview(),
      getPaymentsNeedingReminder(),
    ]);

    const lines = [
      "💰 <b>Finance Reminder</b>",
      `📅 ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
      "",
      "<b>This Month:</b>",
    ];

    for (const c of overview.currencies) {
      lines.push(
        "",
        `<b>${c.currency}</b>`,
        `Income: ${formatCurrency(c.income, c.currency)}`,
        `Expenses: ${formatCurrency(c.expenses, c.currency)}`,
        `Net: ${formatCurrency(c.net, c.currency)}`,
        `Wealth: ${formatCurrency(c.totalBalance, c.currency)}`,
      );
    }

    if (dueSoon.length > 0) {
      lines.push("", `<b>Payments Due Soon (${dueSoon.length}):</b>`);
      for (const p of dueSoon) {
        const amount = p.amount ? formatCurrency(p.amount, p.currency) : "amount TBD";
        const when =
          p.daysUntil === 0
            ? "TODAY"
            : p.daysUntil === 1
              ? "tomorrow"
              : `in ${p.daysUntil} days`;
        lines.push(`• <b>${p.title}</b> — ${amount} (${when})`);
      }
    } else if (overview.upcomingPayments.length > 0) {
      const next = overview.upcomingPayments[0];
      const amount = next.amount ? formatCurrency(next.amount, next.currency) : "amount TBD";
      lines.push("", `<b>Next payment:</b> ${next.title} — ${amount} on ${next.dueDate}`);
    } else {
      lines.push("", "No payment reminders configured yet.");
    }

    const [telegramResult, emailResult] = await Promise.all([
      sendTelegramMessage(lines.join("\n")),
      sendPaymentReminderEmail(),
    ]);

    if (!telegramResult.ok && !emailResult.ok) {
      return NextResponse.json(
        {
          sent: false,
          error: telegramResult.error ?? ("error" in emailResult ? emailResult.error : "Failed"),
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      sent: true,
      dueSoon: dueSoon.length,
      telegram: { sent: telegramResult.ok },
      email: { sent: emailResult.ok, skipped: "skipped" in emailResult ? emailResult.skipped : false },
    });
  } catch (error) {
    console.error("[Finance Notify]", error);
    return NextResponse.json({ error: "Failed to send finance reminder" }, { status: 500 });
  }
}
