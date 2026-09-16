"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Camera,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { DebtsPanel } from "@/components/finance/debts-panel";
import { buildQuickPayItems, QuickPayBar } from "@/components/finance/quick-pay-bar";
import { ReceiptCapturePanel } from "@/components/finance/receipt-capture";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VoiceInput, VoiceTextarea } from "@/components/ui/voice-field";
import { formatDateLocalized } from "@/lib/i18n";
import { SUPPORTED_CURRENCIES, type FinanceCurrency } from "@/lib/finance/constants";
import { formatCurrency } from "@/lib/utils";
import type {
  CurrencyTotals,
  FinanceOverview,
  FinanceTransaction,
  Debt,
  PaymentCategory,
  PaymentReminder,
  TransactionType,
} from "@/types/finance";

type Tab = "overview" | "transactions" | "debts" | "payments" | "receipts";

const TAB_FROM_QUERY: Record<string, Tab> = {
  overview: "overview",
  transactions: "transactions",
  expenses: "transactions",
  debts: "debts",
  payments: "payments",
  receipts: "receipts",
};

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted transition-colors disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/50 transition-colors";

const expenseCategories = [
  "food",
  "transport",
  "housing",
  "shopping",
  "bills",
  "credit card",
  "entertainment",
  "health",
  "education",
  "other",
];

const incomeCategories = ["salary", "bonus", "investment", "freelance", "refund", "other"];

function categoryKey(value: string) {
  return value.replace(/ /g, "_");
}

function tabFromQuery(q: string | null): Tab {
  return (q && TAB_FROM_QUERY[q]) || "transactions";
}

export function FinanceDashboard() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("transactions");
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentReminder[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingNotify, setSendingNotify] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [startMonth, setStartMonth] = useState("2026-06");
  const [viewMonth, setViewMonth] = useState("2026-06");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const month = viewMonth || startMonth;
      const monthQuery = `?month=${encodeURIComponent(month)}`;
      const [overviewRes, txRes, payRes, debtRes, settingsRes] = await Promise.all([
        fetch(`/api/finance/overview${monthQuery}`),
        fetch("/api/finance/transactions"),
        fetch("/api/finance/payments"),
        fetch("/api/finance/debts"),
        fetch("/api/settings"),
      ]);
      const [overviewData, txData, payData, debtData, settingsData] = await Promise.all([
        overviewRes.json(),
        txRes.json(),
        payRes.json(),
        debtRes.json(),
        settingsRes.json(),
      ]);
      setAutoMode(settingsData.financeAutoMode !== false);
      const start = settingsData.financeStartMonth ?? "2026-06";
      setStartMonth(start);
      setOverview(overviewData.overview ?? null);
      setTransactions(txData.transactions ?? []);
      setPayments(payData.payments ?? []);
      setDebts(debtData.debts ?? []);
    } finally {
      setLoading(false);
    }
  }, [viewMonth, startMonth]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function refreshPage() {
    await loadAll();
  }

  useEffect(() => {
    setTab(tabFromQuery(searchParams.get("tab")));
  }, [searchParams]);

  function selectTab(id: Tab) {
    setTab(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id === "transactions") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    const query = params.toString();
    router.replace(query ? `/dashboard/finance?${query}` : "/dashboard/finance", { scroll: false });
  }

  async function sendFinanceReminder() {
    setSendingNotify(true);
    try {
      await fetch("/api/finance/notify", { method: "POST" });
    } finally {
      setSendingNotify(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Wallet }[] = [
    { id: "overview", label: t("finance.tabOverview"), icon: Wallet },
    { id: "transactions", label: t("finance.tabTransactions"), icon: ArrowUpRight },
    { id: "debts", label: t("finance.tabDebts"), icon: Landmark },
    { id: "receipts", label: t("finance.tabReceipts"), icon: Camera },
    { id: "payments", label: t("finance.tabPayments"), icon: CreditCard },
  ];

  const showQuickStart =
    !loading &&
    transactions.length === 0 &&
    (overview?.totalDebt?.length ?? 0) === 0;

  const paymentLabel = (cat: PaymentCategory) => t(`categories.payment.${cat}`);
  const quickPayItems = buildQuickPayItems(payments, debts.filter((d) => d.balance > 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("finance.title")}</h1>
          <p className="mt-1 text-muted">{t("finance.subtitle")}</p>
          <p className="mt-2 text-sm font-medium text-accent">
            {t("finance.trackingFrom", { month: startMonth })}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">{t("finance.viewMonth")}</label>
            <input
              type="month"
              min={startMonth}
              value={viewMonth || startMonth}
              onChange={(e) => setViewMonth(e.target.value)}
              className="rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={refreshPage}
            disabled={loading}
            className={btnGhost}
            title={t("common.refresh")}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </button>
          <button
            type="button"
            onClick={sendFinanceReminder}
            disabled={sendingNotify}
            className={btnPrimary}
          >
            {sendingNotify ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("finance.sendReminder")}
          </button>
        </div>
      </div>

      {autoMode && (
        <Card className="border-success/40 bg-success/5 p-4">
          <p className="font-semibold text-success">{t("finance.autoModeOn")}</p>
          <p className="mt-1 text-sm text-muted">{t("finance.autoModeDesc")}</p>
        </Card>
      )}

      {!loading && quickPayItems.length > 0 && (
        <QuickPayBar items={quickPayItems} onChange={loadAll} />
      )}

      {showQuickStart && (
        <Card className="border-accent/40 bg-accent/5 p-5">
          <p className="font-semibold text-foreground">{t("finance.quickStartTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("finance.quickStartDesc")}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => selectTab("transactions")} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              {t("finance.quickAddExpense")}
            </button>
            <button type="button" onClick={() => selectTab("debts")} className={btnGhost}>
              <Landmark className="h-4 w-4" />
              {t("finance.quickAddDebt")}
            </button>
          </div>
        </Card>
      )}

      {overview && (
        <div className="grid gap-4 lg:grid-cols-2">
          {overview.currencies.map((totals) => (
            <CurrencySummaryCard key={totals.currency} totals={totals} />
          ))}
          {(overview.totalDebt?.length ?? 0) > 0 && (
            <Card className="border-danger/30 bg-danger/5 p-5 lg:col-span-2">
              <p className="text-sm font-semibold text-foreground">{t("finance.totalDebt")}</p>
              <div className="mt-2 flex flex-wrap gap-6">
                {(overview.totalDebt ?? []).map(({ currency, amount }) => (
                  <p key={currency} className="text-xl font-bold text-danger">
                    {formatCurrency(amount, currency)}
                  </p>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-card-border bg-card p-1 [-webkit-overflow-scrolling:touch]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`flex min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:min-w-0 sm:flex-1 sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm ${
              tab === id ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="max-w-[5rem] truncate text-center leading-tight sm:max-w-none">
              {label}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <>
          {tab === "overview" && overview && (
            <OverviewPanel
              overview={overview}
              payments={payments}
              paymentLabel={paymentLabel}
            />
          )}
          {tab === "transactions" && (
            <TransactionsPanel transactions={transactions} onChange={loadAll} />
          )}
          {tab === "debts" && (
            <DebtsPanel onChange={loadAll} paymentLabel={paymentLabel} />
          )}
          {tab === "receipts" && (
            <ReceiptCapturePanel onChange={loadAll} />
          )}
          {tab === "payments" && (
            <PaymentsPanel
              payments={payments}
              upcoming={overview?.upcomingPayments ?? []}
              paymentLabel={paymentLabel}
              onChange={loadAll}
            />
          )}
        </>
      )}
    </div>
  );
}

function CurrencySummaryCard({ totals }: { totals: CurrencyTotals }) {
  const { t } = useLocale();
  const currencyLabel =
    totals.currency === "MYR" ? t("finance.myr") : t("finance.cny");

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold text-accent">{currencyLabel}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="text-center">
          <p className="text-xs text-muted">{t("finance.incomeLabel")}</p>
          <p className="mt-1 text-lg font-bold text-success">
            {formatCurrency(totals.income, totals.currency)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted">{t("finance.expenseLabel")}</p>
          <p className="mt-1 text-lg font-bold text-danger">
            {formatCurrency(totals.expenses, totals.currency)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted">{t("finance.netLabel")}</p>
          <p
            className={`mt-1 text-lg font-bold ${totals.net >= 0 ? "text-success" : "text-danger"}`}
          >
            {formatCurrency(totals.net, totals.currency)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted">{t("finance.wealthLabel")}</p>
          <p
            className={`mt-1 text-lg font-bold ${totals.totalBalance >= 0 ? "text-accent" : "text-danger"}`}
          >
            {formatCurrency(totals.totalBalance, totals.currency)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function OverviewPanel({
  overview,
  payments,
  paymentLabel,
}: {
  overview: FinanceOverview;
  payments: PaymentReminder[];
  paymentLabel: (cat: PaymentCategory) => string;
}) {
  const { t, locale } = useLocale();

  return (
    <div className="space-y-6">
      {overview.currencies.map((totals) => {
        const topExpenses = Object.entries(totals.expensesByCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
        const topIncome = Object.entries(totals.incomeByCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        return (
          <div key={totals.currency} className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={`${t("finance.incomeBreakdown")} (${totals.currency})`}
                description={t("common.month", { month: overview.month })}
              />
              {topIncome.length === 0 ? (
                <p className="text-sm text-muted">{t("finance.noIncome")}</p>
              ) : (
                <div className="space-y-3">
                  {topIncome.map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="capitalize text-sm text-foreground">
                        {t(`categories.income.${categoryKey(category)}`)}
                      </span>
                      <span className="text-sm font-medium text-success">
                        {formatCurrency(amount, totals.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <CardHeader
                title={`${t("finance.expenseBreakdown")} (${totals.currency})`}
                description={t("common.month", { month: overview.month })}
              />
              {topExpenses.length === 0 ? (
                <p className="text-sm text-muted">{t("finance.noExpenses")}</p>
              ) : (
                <div className="space-y-3">
                  {topExpenses.map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="capitalize text-sm text-foreground">
                        {t(`categories.expense.${categoryKey(category)}`)}
                      </span>
                      <span className="text-sm font-medium text-danger">
                        {formatCurrency(amount, totals.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        );
      })}

    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title={t("finance.upcomingPayments")}
          description={t("finance.activeReminders", {
            count: overview.upcomingPayments.length,
          })}
        />
        {overview.upcomingPayments.length === 0 ? (
          <p className="text-sm text-muted">{t("finance.noPayments")}</p>
        ) : (
          <div className="space-y-3">
            {overview.upcomingPayments.slice(0, 6).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-card-border bg-background/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">{p.title}</p>
                  <p className="text-xs text-muted">
                    {t("common.due")} {formatDateLocalized(p.dueDate, locale)} ·{" "}
                    {paymentLabel(p.category)}
                  </p>
                </div>
                <div className="text-right">
                  {p.amount && (
                    <p className="font-medium text-foreground">
                      {formatCurrency(p.amount, p.currency)}
                    </p>
                  )}
                  <Badge
                    variant={
                      p.isOverdue ? "danger" : p.needsReminder ? "warning" : "muted"
                    }
                  >
                    {p.isOverdue
                      ? t("common.overdue")
                      : p.daysUntil === 0
                        ? t("common.dueToday")
                        : t("common.daysLeft", { days: p.daysUntil })}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {payments.length > 0 && (
        <p className="text-xs text-muted">
          <Bell className="mr-1 inline h-3.5 w-3.5" />
          {t("finance.remindBefore", {
            days: payments[0]?.remind_days_before ?? 3,
          })}
        </p>
      )}
    </div>
    </div>
  );
}

function TransactionsPanel({
  transactions,
  onChange,
}: {
  transactions: FinanceTransaction[];
  onChange: () => void;
}) {
  const { t, locale } = useLocale();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [description, setDescription] = useState("");
  const [account, setAccount] = useState("cash");
  const [currency, setCurrency] = useState<FinanceCurrency>("MYR");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const categories = type === "income" ? incomeCategories : expenseCategories;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    try {
      await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: value,
          currency,
          category,
          description: description.trim(),
          account,
          transaction_date: date,
        }),
      });
      setAmount("");
      setDescription("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTx(id: string) {
    await fetch(`/api/finance/transactions/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title={t("finance.addRecord")} description={t("finance.addRecordDesc")} />
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setType("income");
                setCategory("salary");
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                type === "income"
                  ? "border-success/50 bg-success/10 text-success"
                  : "border-card-border text-muted"
              }`}
            >
              <ArrowDownLeft className="mr-1 inline h-4 w-4" />
              {t("finance.income")}
            </button>
            <button
              type="button"
              onClick={() => {
                setType("expense");
                setCategory("food");
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                type === "expense"
                  ? "border-danger/50 bg-danger/10 text-danger"
                  : "border-card-border text-muted"
              }`}
            >
              <ArrowUpRight className="mr-1 inline h-4 w-4" />
              {t("finance.expense")}
            </button>
          </div>
          <input
            type="number"
            min={0.01}
            step={0.01}
            className={inputClass}
            placeholder={t("finance.amount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className={inputClass}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as FinanceCurrency)}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === "MYR" ? t("finance.myr") : t("finance.cny")}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${type}.${categoryKey(c)}`)}
              </option>
            ))}
          </select>
          <VoiceInput
            className={inputClass}
            placeholder={t("finance.description")}
            value={description}
            onValueChange={setDescription}
          />
          <select
            className={inputClass}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="cash">{t("categories.account.cash")}</option>
            <option value="bank">{t("categories.account.bank")}</option>
            <option value="credit_card">{t("categories.account.credit_card")}</option>
            <option value="paypal">{t("categories.account.paypal")}</option>
            <option value="investment">{t("categories.account.investment")}</option>
          </select>
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving || !amount}
            className={`${btnPrimary} w-full justify-center`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {type === "income" ? t("finance.addIncome") : t("finance.addExpense")}
          </button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title={t("finance.history")}
          description={t("common.records", { count: transactions.length })}
        />
        {transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("finance.noTransactions")}</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border border-card-border bg-background/50 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 rounded-full p-1.5 ${
                      tx.type === "income" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}
                  >
                    {tx.type === "income" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {tx.description || tx.category}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateLocalized(tx.transaction_date, locale)} ·{" "}
                      {t(`categories.${tx.type}.${categoryKey(tx.category)}`)} ·{" "}
                      {t(`categories.account.${categoryKey(tx.account)}`)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p
                    className={`font-semibold ${
                      tx.type === "income" ? "text-success" : "text-danger"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                  <button type="button" className={btnGhost} onClick={() => deleteTx(tx.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PaymentsPanel({
  payments,
  upcoming,
  paymentLabel,
  onChange,
}: {
  payments: PaymentReminder[];
  upcoming: FinanceOverview["upcomingPayments"];
  paymentLabel: (cat: PaymentCategory) => string;
  onChange: () => void;
}) {
  const { t, locale } = useLocale();
  const [debts, setDebts] = useState<{ id: string; title: string; balance: number; currency: string }[]>([]);
  const [paidNotice, setPaidNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [category, setCategory] = useState<PaymentCategory>("credit_card");
  const [notes, setNotes] = useState("");
  const [remindBefore, setRemindBefore] = useState("3");
  const [currency, setCurrency] = useState<FinanceCurrency>("MYR");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/finance/debts")
      .then((r) => r.json())
      .then((d) => setDebts(d.debts ?? []))
      .catch(() => setDebts([]));
  }, [payments]);

  const debtById = new Map(debts.map((d) => [d.id, d]));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          amount: amount ? Number(amount) : null,
          currency,
          due_day: Number(dueDay),
          category,
          notes: notes.trim() || null,
          remind_days_before: Number(remindBefore),
        }),
      });
      setTitle("");
      setAmount("");
      setNotes("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(id: string, amount?: number) {
    setPaidNotice(null);
    const res = await fetch(`/api/finance/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mark_paid: true,
        log_expense: true,
        ...(amount ? { pay_amount: amount } : {}),
      }),
    });
    const data = await res.json();
    if (data.debtDeduction?.paid) {
      setPaidNotice(
        t("finance.debtReduced", {
          amount: formatCurrency(data.debtDeduction.paid, data.debtDeduction.debt.currency),
        }),
      );
    } else {
      setPaidNotice(t("finance.markedPaidNoDebt"));
    }
    onChange();
  }

  async function deletePayment(id: string) {
    await fetch(`/api/finance/payments/${id}`, { method: "DELETE" });
    onChange();
  }

  const upcomingMap = new Map(upcoming.map((u) => [u.id, u]));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader title={t("finance.addPayment")} description={t("finance.addPaymentDesc")} />
        <form onSubmit={handleAdd} className="space-y-3">
          <input
            className={inputClass}
            placeholder={t("finance.paymentName")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="number"
            min={0.01}
            step={0.01}
            className={inputClass}
            placeholder={t("finance.amountOptional")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className={inputClass}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as FinanceCurrency)}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === "MYR" ? t("finance.myr") : t("finance.cny")}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">{t("finance.dueDay")}</label>
              <input
                type="number"
                min={1}
                max={31}
                className={inputClass}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">{t("finance.remindDays")}</label>
              <input
                type="number"
                min={0}
                max={30}
                className={inputClass}
                value={remindBefore}
                onChange={(e) => setRemindBefore(e.target.value)}
              />
            </div>
          </div>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as PaymentCategory)}
          >
            {(
              [
                "credit_card",
                "bank_loan",
                "mortgage",
                "utility",
                "subscription",
                "insurance",
                "other",
              ] as PaymentCategory[]
            ).map((value) => (
              <option key={value} value={value}>
                {paymentLabel(value)}
              </option>
            ))}
          </select>
          <VoiceTextarea
            className={`${inputClass} min-h-[60px] resize-y`}
            placeholder={t("finance.paymentNotes")}
            value={notes}
            onValueChange={setNotes}
          />
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className={`${btnPrimary} w-full justify-center`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("finance.addReminder")}
          </button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title={t("finance.schedule")}
          description={t("finance.scheduleDesc")}
        />
        {paidNotice && (
          <p className="mb-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {paidNotice}
          </p>
        )}
        {payments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("finance.noPayments")}</p>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => {
              const next = upcomingMap.get(p.id);
              const linked =
                (p.debt_id && debtById.get(p.debt_id)) ||
                debts.find(
                  (d) =>
                    d.title.trim().toLowerCase() === p.title.trim().toLowerCase() &&
                    d.currency === p.currency,
                );
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-card-border bg-background/50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{p.title}</p>
                        <Badge variant="default">{paymentLabel(p.category)}</Badge>
                        {!p.is_active && <Badge variant="muted">{t("common.paused")}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {locale === "zh"
                          ? `每月 ${p.due_day} 日到期 · 提前 ${p.remind_days_before} 天提醒`
                          : `Due on day ${p.due_day} each month · remind ${p.remind_days_before}d before`}
                        {p.last_paid_at &&
                          ` · ${locale === "zh" ? "上次付款" : "last paid"} ${formatDateLocalized(p.last_paid_at, locale)}`}
                      </p>
                      {p.notes && <p className="mt-1 text-sm text-muted">{p.notes}</p>}
                      {linked && linked.balance > 0 && (
                        <p className="mt-1 text-xs text-danger">
                          {t("finance.linkedDebtBalance", {
                            amount: formatCurrency(linked.balance, linked.currency),
                          })}
                        </p>
                      )}
                      {p.auto_deduct_monthly !== false && (
                        <p className="mt-1 text-xs text-muted">{t("finance.autoDeductHint")}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {p.amount && (
                        <p className="font-medium text-foreground">
                          {formatCurrency(p.amount, p.currency)}
                        </p>
                      )}
                      {next && (
                        <Badge
                          variant={
                            next.isOverdue
                              ? "danger"
                              : next.needsReminder
                                ? "warning"
                                : "muted"
                          }
                        >
                          {next.isOverdue
                            ? t("common.overdue")
                            : next.daysUntil === 0
                              ? t("common.dueToday")
                              : t("common.dueIn", { days: next.daysUntil })}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.amount && p.amount > 0 && (
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 sm:flex-none"
                        onClick={() => markPaid(p.id, p.amount!)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("finance.quickPayTap", {
                          amount: formatCurrency(p.amount, p.currency),
                        })}
                      </button>
                    )}
                    <button type="button" className={btnGhost} onClick={() => markPaid(p.id)}>
                      {p.amount ? t("finance.quickPayOther") : t("common.markPaid")}
                    </button>
                    <button type="button" className={btnGhost} onClick={() => deletePayment(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
