import { SUPPORTED_CURRENCIES, type FinanceCurrency } from "@/lib/finance/constants";
import type { Debt, FinanceTransaction, PaymentReminder } from "@/types/finance";

export function monthKey(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey() {
  return monthKey(new Date());
}

export function clampDueDay(day: number, year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(day, 1), lastDay);
}

export function getNextDueDate(dueDay: number, from = new Date()) {
  const year = from.getFullYear();
  const month = from.getMonth();
  const day = clampDueDay(dueDay, year, month);
  let due = new Date(year, month, day);
  due.setHours(0, 0, 0, 0);

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  if (due < today) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const normalizedMonth = nextMonth % 12;
    const nextDay = clampDueDay(dueDay, nextYear, normalizedMonth);
    due = new Date(nextYear, normalizedMonth, nextDay);
    due.setHours(0, 0, 0, 0);
  }

  return due;
}

export function daysUntil(date: Date, from = new Date()) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function normalizeCurrency(currency: string): FinanceCurrency {
  return currency === "CNY" ? "CNY" : "MYR";
}

export function sumTransactions(
  transactions: FinanceTransaction[],
  type: "income" | "expense",
  options?: { month?: string; currency?: FinanceCurrency },
) {
  return transactions
    .filter((t) => {
      if (t.type !== type) return false;
      if (options?.month && monthKey(t.transaction_date) !== options.month) return false;
      if (options?.currency && normalizeCurrency(t.currency) !== options.currency) return false;
      return true;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

export function groupByCategory(
  transactions: FinanceTransaction[],
  type: "income" | "expense",
  options?: { month?: string; currency?: FinanceCurrency },
) {
  const result: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== type) continue;
    if (options?.month && monthKey(t.transaction_date) !== options.month) continue;
    if (options?.currency && normalizeCurrency(t.currency) !== options.currency) continue;
    result[t.category] = (result[t.category] ?? 0) + t.amount;
  }
  return result;
}

export function buildCurrencyTotals(
  transactions: FinanceTransaction[],
  month: string,
): import("@/types/finance").CurrencyTotals[] {
  return SUPPORTED_CURRENCIES.map((currency) => {
    const income = sumTransactions(transactions, "income", { month, currency });
    const expenses = sumTransactions(transactions, "expense", { month, currency });
    const totalIncome = sumTransactions(transactions, "income", { currency });
    const totalExpenses = sumTransactions(transactions, "expense", { currency });

    return {
      currency,
      income,
      expenses,
      net: income - expenses,
      totalBalance: totalIncome - totalExpenses,
      incomeByCategory: groupByCategory(transactions, "income", { month, currency }),
      expensesByCategory: groupByCategory(transactions, "expense", { month, currency }),
    };
  });
}

export function buildDebtTotals(debts: Debt[]) {
  const totals: Record<FinanceCurrency, number> = { MYR: 0, CNY: 0 };
  for (const d of debts) {
    if (d.balance <= 0) continue;
    const c = normalizeCurrency(d.currency);
    totals[c] += d.balance;
  }
  return SUPPORTED_CURRENCIES.filter((c) => totals[c] > 0).map((currency) => ({
    currency,
    amount: totals[currency],
  }));
}

export function buildUpcomingPayments(reminders: PaymentReminder[], from = new Date()) {
  return reminders
    .filter((r) => r.is_active)
    .map((r) => {
      const dueDate = getNextDueDate(r.due_day, from);
      const days = daysUntil(dueDate, from);
      const isOverdue = days < 0;
      const needsReminder = days >= 0 && days <= r.remind_days_before;

      return {
        id: r.id,
        title: r.title,
        amount: r.amount,
        currency: r.currency,
        category: r.category,
        dueDate: dueDate.toISOString().split("T")[0],
        daysUntil: days,
        isOverdue,
        needsReminder,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
