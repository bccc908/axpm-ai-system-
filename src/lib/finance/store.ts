import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  applyDebtDeduction,
  findDebtForReminder,
  linkRemindersToDebts,
  normalizeTitle,
  resolveMonthlyPaymentAmount,
  runFullFinanceAutomation,
  wasPaidThisMonth,
} from "@/lib/finance/debt-payments";
import {
  effectiveOverviewMonth,
  getFinanceStartMonth,
  isFinanceAutoMode,
} from "@/lib/finance/settings";
import {
  buildCurrencyTotals,
  buildDebtTotals,
  buildUpcomingPayments,
  normalizeCurrency,
} from "@/lib/finance/helpers";
import type {
  FinanceData,
  FinanceOverview,
  Debt,
  FinanceReceipt,
  FinanceTransaction,
  PaymentReminder,
} from "@/types/finance";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "personal-finance.json");
export const RECEIPTS_DIR = path.join(DATA_DIR, "receipts");

const emptyData = (): FinanceData => ({
  transactions: [],
  paymentReminders: [],
  receipts: [],
  debts: [],
});

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(emptyData(), null, 2));
  }
}

function migrateFinanceData(data: FinanceData) {
  if (!data.receipts) data.receipts = [];
  if (!data.debts) data.debts = [];
  for (const r of data.paymentReminders) {
    if (r.debt_id === undefined) r.debt_id = null;
    if (r.auto_deduct_monthly === undefined) r.auto_deduct_monthly = true;
  }
}

async function loadFinanceData(): Promise<FinanceData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const data = JSON.parse(raw) as FinanceData;
  migrateFinanceData(data);
  return data;
}

export async function readFinanceData(): Promise<FinanceData> {
  const data = await loadFinanceData();
  const auto = await isFinanceAutoMode();

  let dirty = false;
  if (auto) {
    const startMonth = await getFinanceStartMonth();
    const result = runFullFinanceAutomation(data, new Date(), startMonth);
    dirty =
      result.deductions.length > 0 ||
      result.remindersCreated > 0 ||
      result.remindersSynced > 0 ||
      result.remindersLinked;
  } else {
    dirty = linkRemindersToDebts(data);
  }

  if (dirty) await writeFinanceData(data);
  return data;
}

export async function runFinanceAutomation() {
  const data = await loadFinanceData();
  migrateFinanceData(data);
  const startMonth = await getFinanceStartMonth();
  const result = runFullFinanceAutomation(data, new Date(), startMonth);
  const dirty =
    result.deductions.length > 0 ||
    result.remindersCreated > 0 ||
    result.remindersSynced > 0 ||
    result.remindersLinked;

  if (dirty) await writeFinanceData(data);

  return {
    ok: true,
    autoMode: await isFinanceAutoMode(),
    applied: result.deductions.length,
    remindersCreated: result.remindersCreated,
    payments: result.deductions.map((d) => ({
      title: d.debt.title,
      paid: d.paid,
      currency: d.debt.currency,
      newBalance: d.debt.balance,
    })),
  };
}

async function writeFinanceData(data: FinanceData) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function listTransactions() {
  const data = await readFinanceData();
  return data.transactions.sort(
    (a, b) =>
      new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
  );
}

export async function createTransaction(
  input: Omit<FinanceTransaction, "id" | "created_at">,
) {
  const data = await readFinanceData();
  const transaction: FinanceTransaction = {
    ...input,
    currency: normalizeCurrency(input.currency),
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  data.transactions.push(transaction);
  await writeFinanceData(data);
  return transaction;
}

export async function deleteTransaction(id: string) {
  const data = await readFinanceData();
  const before = data.transactions.length;
  data.transactions = data.transactions.filter((t) => t.id !== id);
  if (data.transactions.length === before) return false;
  await writeFinanceData(data);
  return true;
}

export async function listPaymentReminders() {
  const data = await readFinanceData();
  return data.paymentReminders.sort((a, b) => a.due_day - b.due_day);
}

export async function createPaymentReminder(
  input: Omit<
    PaymentReminder,
    "id" | "created_at" | "updated_at" | "last_paid_at"
  >,
) {
  const data = await readFinanceData();
  const now = new Date().toISOString();
  const currency = normalizeCurrency(input.currency);
  const draft: PaymentReminder = {
    ...input,
    currency,
    id: randomUUID(),
    debt_id: input.debt_id ?? null,
    auto_deduct_monthly: input.auto_deduct_monthly ?? true,
    last_paid_at: null,
    created_at: now,
    updated_at: now,
  };
  const linked = findDebtForReminder(draft, data.debts);
  const reminder: PaymentReminder = {
    ...draft,
    debt_id: draft.debt_id ?? linked?.id ?? null,
    auto_deduct_monthly: linked || draft.debt_id ? true : draft.auto_deduct_monthly,
  };
  data.paymentReminders.push(reminder);
  await writeFinanceData(data);
  return reminder;
}

export async function updatePaymentReminder(
  id: string,
  patch: Partial<PaymentReminder>,
) {
  const data = await readFinanceData();
  const index = data.paymentReminders.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const current = data.paymentReminders[index];
  const reminder: PaymentReminder = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  };
  data.paymentReminders[index] = reminder;
  await writeFinanceData(data);
  return reminder;
}

export async function deletePaymentReminder(id: string) {
  const data = await readFinanceData();
  const before = data.paymentReminders.length;
  data.paymentReminders = data.paymentReminders.filter((r) => r.id !== id);
  if (data.paymentReminders.length === before) return false;
  await writeFinanceData(data);
  return true;
}

export async function markPaymentPaid(
  id: string,
  options?: { amount?: number; logExpense?: boolean },
) {
  const data = await readFinanceData();
  const index = data.paymentReminders.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const reminder = data.paymentReminders[index];
  const debt = findDebtForReminder(reminder, data.debts);
  const payAmount = options?.amount ?? resolveMonthlyPaymentAmount(reminder, debt);
  const logExpense = options?.logExpense ?? true;
  const alreadyPaidThisMonth = wasPaidThisMonth(reminder.last_paid_at);

  let debtDeduction: ReturnType<typeof applyDebtDeduction> = null;
  if (debt && payAmount > 0 && !alreadyPaidThisMonth) {
    debtDeduction = applyDebtDeduction(data, debt.id, payAmount, {
      logExpense,
      description: `Monthly payment: ${reminder.title}`,
    });
  }

  const now = new Date().toISOString();
  data.paymentReminders[index] = {
    ...reminder,
    last_paid_at: now,
    debt_id: reminder.debt_id ?? debt?.id ?? null,
    updated_at: now,
  };

  await writeFinanceData(data);
  return {
    payment: data.paymentReminders[index],
    debtDeduction,
  };
}

export async function getFinanceOverview(month?: string): Promise<FinanceOverview> {
  const data = await readFinanceData();
  const startMonth = await getFinanceStartMonth();
  const viewMonth = effectiveOverviewMonth(month, startMonth);

  return {
    month: viewMonth,
    currencies: buildCurrencyTotals(data.transactions, viewMonth),
    totalDebt: buildDebtTotals(data.debts),
    upcomingPayments: buildUpcomingPayments(data.paymentReminders),
  };
}

export async function listDebts() {
  const data = await readFinanceData();
  return data.debts
    .filter((d) => d.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .concat(data.debts.filter((d) => d.balance <= 0));
}

export async function createDebt(
  input: Omit<Debt, "id" | "created_at" | "updated_at">,
  options?: { createMonthlyReminder?: boolean },
) {
  const data = await readFinanceData();
  const now = new Date().toISOString();
  const debt: Debt = {
    ...input,
    currency: normalizeCurrency(input.currency),
    id: randomUUID(),
    created_at: now,
    updated_at: now,
  };
  data.debts.push(debt);

  const autoMode = await isFinanceAutoMode();
  if (autoMode && options?.createMonthlyReminder !== false) {
    const hasReminder = data.paymentReminders.some(
      (r) =>
        r.debt_id === debt.id ||
        (normalizeTitle(r.title) === normalizeTitle(debt.title) &&
          normalizeCurrency(r.currency) === debt.currency),
    );
    if (!hasReminder) {
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
    }
  }

  await writeFinanceData(data);
  return debt;
}

export async function updateDebt(id: string, patch: Partial<Debt>) {
  const data = await readFinanceData();
  const index = data.debts.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const current = data.debts[index];
  const debt: Debt = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  };
  data.debts[index] = debt;
  await writeFinanceData(data);
  return debt;
}

export async function deleteDebt(id: string) {
  const data = await readFinanceData();
  const before = data.debts.length;
  data.debts = data.debts.filter((d) => d.id !== id);
  if (data.debts.length === before) return false;
  await writeFinanceData(data);
  return true;
}

export async function payDownDebt(
  id: string,
  amount: number,
  options?: { logExpense?: boolean },
) {
  const data = await readFinanceData();
  const debt = data.debts.find((d) => d.id === id);
  if (!debt) return null;

  const result = applyDebtDeduction(data, id, amount, {
    logExpense: options?.logExpense ?? true,
    description: `Debt payment: ${debt.title}`,
  });
  if (!result) return null;

  const now = new Date().toISOString();
  for (const reminder of data.paymentReminders) {
    if (reminder.debt_id === id || findDebtForReminder(reminder, [result.debt])?.id === id) {
      reminder.last_paid_at = now;
      reminder.debt_id = id;
      reminder.updated_at = now;
    }
  }

  await writeFinanceData(data);
  return { debt: result.debt, paid: result.paid };
}

export async function getPaymentsNeedingReminder() {
  const data = await readFinanceData();
  return buildUpcomingPayments(data.paymentReminders).filter((p) => p.needsReminder);
}

export async function listReceipts() {
  const data = await readFinanceData();
  return data.receipts.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function getReceipt(id: string) {
  const data = await readFinanceData();
  return data.receipts.find((r) => r.id === id) ?? null;
}

export async function createReceipt(
  input: Omit<FinanceReceipt, "id" | "created_at">,
) {
  const data = await readFinanceData();
  const receipt: FinanceReceipt = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  data.receipts.unshift(receipt);
  await writeFinanceData(data);
  return receipt;
}

export async function updateReceipt(id: string, patch: Partial<FinanceReceipt>) {
  const data = await readFinanceData();
  const index = data.receipts.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const current = data.receipts[index];
  const receipt: FinanceReceipt = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
  };
  data.receipts[index] = receipt;
  await writeFinanceData(data);
  return receipt;
}

export async function deleteReceipt(id: string) {
  const data = await readFinanceData();
  const receipt = data.receipts.find((r) => r.id === id);
  if (!receipt) return false;

  data.receipts = data.receipts.filter((r) => r.id !== id);
  await writeFinanceData(data);

  try {
    await fs.unlink(path.join(RECEIPTS_DIR, receipt.filename));
  } catch {
    // file may already be missing
  }
  return true;
}

export async function ensureReceiptsDir() {
  await fs.mkdir(RECEIPTS_DIR, { recursive: true });
}
