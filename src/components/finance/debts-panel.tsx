"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VoiceInput, VoiceTextarea } from "@/components/ui/voice-field";
import { SUPPORTED_CURRENCIES, type FinanceCurrency } from "@/lib/finance/constants";
import { formatCurrency } from "@/lib/utils";
import type { Debt, PaymentCategory } from "@/types/finance";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted hover:text-foreground";
const btnPay =
  "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

export function DebtsPanel({
  onChange,
  paymentLabel,
}: {
  onChange: () => void;
  paymentLabel: (cat: PaymentCategory) => string;
}) {
  const { t } = useLocale();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [balance, setBalance] = useState("");
  const [minPayment, setMinPayment] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [category, setCategory] = useState<PaymentCategory>("credit_card");
  const [currency, setCurrency] = useState<FinanceCurrency>("CNY");
  const [notes, setNotes] = useState("");
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/debts");
      const data = await res.json();
      setDebts(data.debts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalByCurrency = debts.reduce(
    (acc, d) => {
      if (d.balance <= 0) return acc;
      acc[d.currency as FinanceCurrency] = (acc[d.currency as FinanceCurrency] ?? 0) + d.balance;
      return acc;
    },
    {} as Record<FinanceCurrency, number>,
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(balance);
    if (!title.trim() || !value || value <= 0) return;
    setSaving(true);
    try {
      await fetch("/api/finance/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          balance: value,
          minimum_payment: minPayment ? Number(minPayment) : null,
          currency,
          category,
          due_day: Number(dueDay),
          notes: notes.trim() || null,
        }),
      });
      setTitle("");
      setBalance("");
      setMinPayment("");
      setNotes("");
      load();
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function payDown(id: string, amount: number) {
    if (!amount || amount <= 0) return;
    await fetch(`/api/finance/debts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pay_amount: amount, log_expense: true }),
    });
    setPayAmounts((prev) => ({ ...prev, [id]: "" }));
    load();
    onChange();
  }

  async function deleteDebt(id: string) {
    await fetch(`/api/finance/debts/${id}`, { method: "DELETE" });
    load();
    onChange();
  }

  return (
    <div className="space-y-6">
      <Card className="border-danger/30 bg-danger/5 p-4">
        <p className="text-sm font-semibold text-foreground">{t("finance.totalDebt")}</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {SUPPORTED_CURRENCIES.map((c) =>
            totalByCurrency[c] ? (
              <p key={c} className="text-xl font-bold text-danger">
                {formatCurrency(totalByCurrency[c], c)}
              </p>
            ) : null,
          )}
          {!Object.values(totalByCurrency).some(Boolean) && (
            <p className="text-sm text-muted">{t("finance.noDebts")}</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("finance.addDebt")} description={t("finance.addDebtDescAuto")} />
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
          <VoiceInput
            className={`${inputClass} sm:col-span-2`}
            placeholder={t("finance.debtName")}
            value={title}
            onValueChange={setTitle}
          />
          <input
            type="number"
            min={0.01}
            step={0.01}
            className={inputClass}
            placeholder={t("finance.balanceOwed")}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
          <input
            type="number"
            min={0}
            step={0.01}
            className={inputClass}
            placeholder={t("finance.minPayment")}
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
          />
          <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value as FinanceCurrency)}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={31}
            className={inputClass}
            placeholder={t("finance.dueDay")}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as PaymentCategory)}>
            {(["credit_card", "bank_loan", "mortgage", "other"] as PaymentCategory[]).map((c) => (
              <option key={c} value={c}>{paymentLabel(c)}</option>
            ))}
          </select>
          <VoiceTextarea
            className={`${inputClass} sm:col-span-2`}
            placeholder={t("finance.paymentNotes")}
            value={notes}
            onValueChange={setNotes}
          />
          <button type="submit" disabled={saving || !title.trim() || !balance} className={`${btnPrimary} sm:col-span-2 justify-center`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("finance.addDebt")}
          </button>
        </form>
      </Card>

      <Card>
        <CardHeader title={t("finance.debtList")} description={t("finance.debtListDesc")} />
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" />
        ) : debts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("finance.noDebts")}</p>
        ) : (
          <div className="space-y-3">
            {debts.map((debt) => (
              <div
                key={debt.id}
                className={`rounded-lg border px-4 py-3 ${
                  debt.balance <= 0
                    ? "border-card-border/50 opacity-60"
                    : "border-card-border bg-background/50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{debt.title}</p>
                    <p className="text-lg font-bold text-danger">
                      {formatCurrency(debt.balance, debt.currency)}
                      {debt.balance <= 0 && (
                        <Badge variant="success" className="ml-2">{t("finance.paidOff")}</Badge>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {paymentLabel(debt.category)}
                      {debt.minimum_payment
                        ? ` · ${t("finance.minPayment")} ${formatCurrency(debt.minimum_payment, debt.currency)}`
                        : ""}
                      {` · ${t("finance.dueDay")} ${debt.due_day}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => deleteDebt(debt.id)} className={btnGhost}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {debt.balance > 0 && (
                  <div className="mt-3 space-y-2">
                    {debt.minimum_payment && debt.minimum_payment > 0 && (
                      <button
                        type="button"
                        className={`${btnPay} w-full`}
                        onClick={() => payDown(debt.id, debt.minimum_payment!)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("finance.quickPayTap", {
                          amount: formatCurrency(debt.minimum_payment!, debt.currency),
                        })}
                      </button>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        className={`${inputClass} min-w-0 flex-1`}
                        placeholder={t("finance.payAmount")}
                        value={payAmounts[debt.id] ?? ""}
                        onChange={(e) =>
                          setPayAmounts((prev) => ({ ...prev, [debt.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => payDown(debt.id, Number(payAmounts[debt.id]))}
                        className={btnGhost}
                        disabled={!payAmounts[debt.id]}
                      >
                        {t("finance.payDown")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
