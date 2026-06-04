import { normalizeCurrency, monthKey, currentMonthKey } from "@/lib/finance/helpers";
import type { Debt, FinanceData, FinanceTransaction, PaymentReminder } from "@/types/finance";
import { randomUUID } from "crypto";

export function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findDebtForReminder(
  reminder: PaymentReminder,
  debts: Debt[],
): Debt | null {
  if (reminder.debt_id) {
    const linked = debts.find((d) => d.id === reminder.debt_id);
    if (linked) return linked;
  }
  const norm = normalizeTitle(reminder.title);
  return (
    debts.find(
      (d) =>
        normalizeTitle(d.title) === norm &&
        normalizeCurrency(d.currency) === normalizeCurrency(reminder.currency),
    ) ?? null
  );
}

export function resolveMonthlyPaymentAmount(
  reminder: PaymentReminder,
  debt: Debt | null,
): number {
  if (reminder.amount != null && reminder.amount > 0) return reminder.amount;
  if (debt?.minimum_payment != null && debt.minimum_payment > 0) {
    return debt.minimum_payment;
  }
  if (debt && debt.balance > 0) return debt.balance;
  return 0;
}

export function wasPaidThisMonth(lastPaidAt: string | null, month = currentMonthKey()) {
  if (!lastPaidAt) return false;
  return monthKey(lastPaidAt) === month;
}

export type DebtDeductionResult = {
  debt: Debt;
  paid: number;
  transaction: FinanceTransaction | null;
};

export function applyDebtDeduction(
  data: FinanceData,
  debtId: string,
  payAmount: number,
  options: {
    logExpense: boolean;
    description: string;
    transactionDate?: string;
  },
): DebtDeductionResult | null {
  const index = data.debts.findIndex((d) => d.id === debtId);
  if (index === -1) return null;

  const current = data.debts[index];
  const pay = Math.min(Math.max(payAmount, 0), current.balance);
  if (pay <= 0) return null;

  const debt: Debt = {
    ...current,
    balance: Math.max(0, current.balance - pay),
    updated_at: new Date().toISOString(),
  };
  data.debts[index] = debt;

  let transaction: FinanceTransaction | null = null;
  if (options.logExpense) {
    transaction = {
      id: randomUUID(),
      type: "expense",
      amount: pay,
      currency: debt.currency,
      category: "bills",
      description: options.description,
      account: "bank",
      transaction_date: options.transactionDate ?? new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
    };
    data.transactions.push(transaction);
  }

  return { debt, paid: pay, transaction };
}

export function linkRemindersToDebts(data: FinanceData) {
  let changed = false;
  for (const reminder of data.paymentReminders) {
    if (reminder.debt_id) continue;
    const debt = findDebtForReminder(reminder, data.debts);
    if (debt) {
      reminder.debt_id = debt.id;
      changed = true;
    }
  }
  return changed;
}

/** After due day each month, auto-reduce linked debt once if not yet paid this month. */
export function processDueMonthlyPayments(
  data: FinanceData,
  from = new Date(),
  financeStartMonth?: string,
) {
  const currentMonth = currentMonthKey();
  if (financeStartMonth && currentMonth < financeStartMonth) {
    return [];
  }
  const todayDay = from.getDate();
  const deductions: DebtDeductionResult[] = [];

  for (const reminder of data.paymentReminders) {
    if (!reminder.is_active) continue;
    if (reminder.auto_deduct_monthly === false) continue;

    const debt = findDebtForReminder(reminder, data.debts);
    if (!debt || debt.balance <= 0) continue;
    if (wasPaidThisMonth(reminder.last_paid_at, currentMonth)) continue;
    if (todayDay < reminder.due_day) continue;

    const payAmount = resolveMonthlyPaymentAmount(reminder, debt);
    if (payAmount <= 0) continue;

    const result = applyDebtDeduction(data, debt.id, payAmount, {
      logExpense: true,
      description: `Monthly payment: ${reminder.title}`,
    });
    if (!result) continue;

    reminder.last_paid_at = from.toISOString();
    reminder.debt_id = debt.id;
    reminder.updated_at = from.toISOString();
    deductions.push(result);
  }

  return deductions;
}

export function ensureRemindersForDebts(data: FinanceData, from = new Date()) {
  let created = 0;
  const now = from.toISOString();

  for (const debt of data.debts) {
    if (debt.balance <= 0) continue;
    const linked = data.paymentReminders.some(
      (r) =>
        r.debt_id === debt.id ||
        (normalizeTitle(r.title) === normalizeTitle(debt.title) &&
          normalizeCurrency(r.currency) === normalizeCurrency(debt.currency)),
    );
    if (linked) continue;

    data.paymentReminders.push({
      id: randomUUID(),
      title: debt.title,
      amount: debt.minimum_payment ?? null,
      currency: debt.currency,
      due_day: debt.due_day,
      category: debt.category,
      notes: debt.notes,
      debt_id: debt.id,
      auto_deduct_monthly: true,
      last_paid_at: null,
      remind_days_before: 3,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    created += 1;
  }

  return created;
}

export function syncRemindersFromDebts(data: FinanceData) {
  let changed = 0;
  for (const debt of data.debts) {
    for (const reminder of data.paymentReminders) {
      const matches =
        reminder.debt_id === debt.id ||
        (normalizeTitle(reminder.title) === normalizeTitle(debt.title) &&
          normalizeCurrency(reminder.currency) === normalizeCurrency(debt.currency));
      if (!matches) continue;

      if (reminder.debt_id !== debt.id) {
        reminder.debt_id = debt.id;
        changed += 1;
      }
      if (reminder.auto_deduct_monthly !== true) {
        reminder.auto_deduct_monthly = true;
        changed += 1;
      }
      if (debt.minimum_payment != null && reminder.amount !== debt.minimum_payment) {
        reminder.amount = debt.minimum_payment;
        changed += 1;
      }
      if (reminder.due_day !== debt.due_day) {
        reminder.due_day = debt.due_day;
        changed += 1;
      }
      reminder.updated_at = new Date().toISOString();
    }
  }
  return changed;
}

export function enableAutoOnAllReminders(data: FinanceData) {
  let changed = 0;
  for (const r of data.paymentReminders) {
    if (r.auto_deduct_monthly === false) {
      r.auto_deduct_monthly = true;
      changed += 1;
    }
  }
  return changed;
}

export type FinanceAutomationResult = {
  deductions: DebtDeductionResult[];
  remindersCreated: number;
  remindersSynced: number;
  remindersLinked: boolean;
};

/** Full auto pass: link → create reminders → sync → deduct due payments */
export function runFullFinanceAutomation(
  data: FinanceData,
  from = new Date(),
  financeStartMonth?: string,
): FinanceAutomationResult {
  const remindersLinked = linkRemindersToDebts(data);
  const remindersCreated = ensureRemindersForDebts(data, from);
  const remindersSynced = syncRemindersFromDebts(data);
  enableAutoOnAllReminders(data);
  const deductions = processDueMonthlyPayments(data, from, financeStartMonth);

  return {
    deductions,
    remindersCreated,
    remindersSynced,
    remindersLinked,
  };
}
