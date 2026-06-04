"use client";

import { useState } from "react";
import { CheckCircle2, CircleDollarSign, Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { Debt, PaymentReminder } from "@/types/finance";

export type QuickPayItem = {
  key: string;
  title: string;
  currency: string;
  amount: number | null;
  balance: number | null;
  paymentId?: string;
  debtId?: string;
};

export function buildQuickPayItems(payments: PaymentReminder[], debts: Debt[]): QuickPayItem[] {
  const items: QuickPayItem[] = [];
  const linkedDebtIds = new Set<string>();

  for (const p of payments.filter((r) => r.is_active)) {
    const debt =
      debts.find((d) => d.id === p.debt_id) ??
      debts.find(
        (d) =>
          d.title.trim().toLowerCase() === p.title.trim().toLowerCase() &&
          d.currency === p.currency,
      );
    if (debt && debt.balance <= 0) continue;

    const amount = p.amount ?? debt?.minimum_payment ?? null;
    if (debt) linkedDebtIds.add(debt.id);

    items.push({
      key: `payment-${p.id}`,
      title: p.title,
      currency: p.currency,
      amount,
      balance: debt?.balance ?? null,
      paymentId: p.id,
      debtId: debt?.id,
    });
  }

  for (const d of debts) {
    if (d.balance <= 0 || linkedDebtIds.has(d.id)) continue;
    items.push({
      key: `debt-${d.id}`,
      title: d.title,
      currency: d.currency,
      amount: d.minimum_payment,
      balance: d.balance,
      debtId: d.id,
    });
  }

  return items;
}

const btnPay =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none";

export function QuickPayBar({
  items,
  onChange,
}: {
  items: QuickPayItem[];
  onChange: () => void;
}) {
  const { t } = useLocale();
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customKey, setCustomKey] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  if (items.length === 0) return null;

  async function recordPayment(item: QuickPayItem, amount: number) {
    if (!amount || amount <= 0) return;
    setPayingKey(item.key);
    setNotice(null);
    try {
      let paid = amount;
      let currency = item.currency;

      if (item.paymentId) {
        const res = await fetch(`/api/finance/payments/${item.paymentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mark_paid: true, pay_amount: amount, log_expense: true }),
        });
        const data = await res.json();
        if (data.debtDeduction?.paid) {
          paid = data.debtDeduction.paid;
          currency = data.debtDeduction.debt.currency;
        }
      } else if (item.debtId) {
        const res = await fetch(`/api/finance/debts/${item.debtId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pay_amount: amount, log_expense: true }),
        });
        const data = await res.json();
        if (data.paid) {
          paid = data.paid;
          currency = data.debt.currency;
        }
      }

      setNotice(t("finance.quickPayDone", { amount: formatCurrency(paid, currency) }));
      setCustomKey(null);
      setCustomAmount("");
      onChange();
    } finally {
      setPayingKey(null);
    }
  }

  function defaultAmount(item: QuickPayItem) {
    if (item.amount && item.amount > 0) return item.amount;
    if (item.balance && item.balance > 0) return item.balance;
    return null;
  }

  return (
    <Card className="border-success/40 bg-gradient-to-b from-success/10 to-card p-4 sm:p-5">
      <CardHeader
        title={t("finance.quickPayTitle")}
        description={t("finance.quickPayDesc")}
      />
      {notice && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/15 px-3 py-2 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}
      <div className="space-y-4">
        {items.map((item) => {
          const preset = defaultAmount(item);
          const isCustom = customKey === item.key;
          const busy = payingKey === item.key;

          return (
            <div
              key={item.key}
              className="rounded-xl border border-card-border bg-background/80 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{item.title}</p>
                  {item.balance != null && item.balance > 0 && (
                    <p className="text-sm text-muted">
                      {t("finance.quickPayOwed")}:{" "}
                      <span className="font-medium text-danger">
                        {formatCurrency(item.balance, item.currency)}
                      </span>
                    </p>
                  )}
                </div>
                <CircleDollarSign className="h-6 w-6 shrink-0 text-success" />
              </div>

              {isCustom ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    className={inputClass}
                    placeholder={t("finance.payAmount")}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={btnPay}
                      disabled={busy || !customAmount}
                      onClick={() => recordPayment(item, Number(customAmount))}
                    >
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("common.save")}
                    </button>
                    <button
                      type="button"
                      className="min-h-[48px] rounded-xl border border-card-border px-3 text-sm text-muted hover:text-foreground"
                      onClick={() => {
                        setCustomKey(null);
                        setCustomAmount("");
                      }}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {preset ? (
                    <button
                      type="button"
                      className={btnPay}
                      disabled={busy}
                      onClick={() => recordPayment(item, preset)}
                    >
                      {busy ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          {t("finance.quickPayTap", {
                            amount: formatCurrency(preset, item.currency),
                          })}
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={btnPay}
                      disabled={busy}
                      onClick={() => {
                        setCustomKey(item.key);
                        setCustomAmount("");
                      }}
                    >
                      {t("finance.quickPayEnterAmount")}
                    </button>
                  )}
                  {preset && (
                    <button
                      type="button"
                      className="w-full py-2 text-center text-sm text-accent hover:underline"
                      onClick={() => {
                        setCustomKey(item.key);
                        setCustomAmount(String(preset));
                      }}
                    >
                      {t("finance.quickPayOther")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
