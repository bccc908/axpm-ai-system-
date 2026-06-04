import type { FinanceCurrency } from "@/lib/finance/constants";

export type TransactionType = "income" | "expense";

export type { FinanceCurrency };

export type PaymentCategory =
  | "credit_card"
  | "bank_loan"
  | "mortgage"
  | "utility"
  | "subscription"
  | "insurance"
  | "other";

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  description: string;
  account: string;
  transaction_date: string;
  created_at: string;
}

export interface PaymentReminder {
  id: string;
  title: string;
  amount: number | null;
  currency: string;
  due_day: number;
  category: PaymentCategory;
  notes: string | null;
  /** Linked debt — marking paid auto-reduces this balance */
  debt_id: string | null;
  /** After due day each month, auto-deduct once if not paid yet (default true) */
  auto_deduct_monthly: boolean;
  last_paid_at: string | null;
  remind_days_before: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  title: string;
  balance: number;
  minimum_payment: number | null;
  currency: string;
  category: PaymentCategory;
  due_day: number;
  interest_rate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceData {
  transactions: FinanceTransaction[];
  paymentReminders: PaymentReminder[];
  receipts: FinanceReceipt[];
  debts: Debt[];
}

export interface FinanceReceipt {
  id: string;
  filename: string;
  mime_type: string;
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  receipt_date: string | null;
  notes: string | null;
  transaction_id: string | null;
  google_drive_file_id: string | null;
  google_drive_url: string | null;
  scanned_at: string | null;
  created_at: string;
}

export interface ReceiptScanResult {
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  receipt_date: string | null;
  notes: string | null;
}

export interface CurrencyTotals {
  currency: FinanceCurrency;
  income: number;
  expenses: number;
  net: number;
  totalBalance: number;
  incomeByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

export interface FinanceOverview {
  month: string;
  currencies: CurrencyTotals[];
  totalDebt: { currency: FinanceCurrency; amount: number }[];
  upcomingPayments: {
    id: string;
    title: string;
    amount: number | null;
    currency: string;
    category: PaymentCategory;
    dueDate: string;
    daysUntil: number;
    isOverdue: boolean;
    needsReminder: boolean;
  }[];
}
