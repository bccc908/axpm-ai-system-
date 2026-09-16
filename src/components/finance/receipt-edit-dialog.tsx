"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, ScanLine, X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { ReceiptPreview } from "@/components/finance/receipt-preview";
import { SUPPORTED_CURRENCIES, type FinanceCurrency } from "@/lib/finance/constants";
import type { FinanceReceipt, ReceiptScanResult } from "@/types/finance";

const EXPENSE_CATEGORIES = [
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

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";

function categoryKey(value: string) {
  return value.replace(/ /g, "_");
}

function applyScanToForm(scan: ReceiptScanResult, setters: {
  setMerchant: (v: string) => void;
  setAmount: (v: string) => void;
  setCurrency: (v: FinanceCurrency) => void;
  setCategory: (v: string) => void;
  setReceiptDate: (v: string) => void;
  setNotes: (v: string) => void;
}) {
  if (scan.merchant) setters.setMerchant(scan.merchant);
  if (scan.amount != null) setters.setAmount(String(scan.amount));
  if (scan.currency && SUPPORTED_CURRENCIES.includes(scan.currency as FinanceCurrency)) {
    setters.setCurrency(scan.currency as FinanceCurrency);
  }
  if (scan.category) setters.setCategory(scan.category);
  if (scan.receipt_date) setters.setReceiptDate(scan.receipt_date);
  if (scan.notes) setters.setNotes(scan.notes);
}

export function ReceiptEditDialog({
  receipt,
  open,
  saving,
  isNewUpload = false,
  onClose,
  onSave,
  onReceiptReplaced,
  saveError,
}: {
  receipt: FinanceReceipt | null;
  open: boolean;
  saving: boolean;
  isNewUpload?: boolean;
  onClose: () => void;
  onSave: (patch: {
    merchant: string;
    amount: number | null;
    currency: FinanceCurrency;
    category: string;
    receipt_date: string;
    notes: string;
  }) => void;
  onReceiptReplaced?: (receipt: FinanceReceipt) => void;
  saveError?: string | null;
}) {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<FinanceCurrency>("MYR");
  const [category, setCategory] = useState("other");
  const [receiptDate, setReceiptDate] = useState("");
  const [notes, setNotes] = useState("");
  const [previewKey, setPreviewKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiScanHint, setAiScanHint] = useState<string | null>(null);

  useEffect(() => {
    if (!receipt || !open) return;

    let cancelled = false;

    async function hydrateForm() {
      try {
        const res = await fetch(`/api/finance/receipts/${receipt!.id}/info`, {
          cache: "no-store",
        });
        const fresh = res.ok ? ((await res.json()).receipt as FinanceReceipt) : receipt!;
        if (cancelled) return;
        applyReceiptToForm(fresh);
      } catch {
        if (!cancelled) applyReceiptToForm(receipt!);
      }
    }

    function applyReceiptToForm(r: FinanceReceipt) {
      setMerchant(r.merchant ?? "");
      setAmount(r.amount != null ? String(r.amount) : "");
      setCurrency(
        SUPPORTED_CURRENCIES.includes((r.currency ?? "MYR") as FinanceCurrency)
          ? ((r.currency ?? "MYR") as FinanceCurrency)
          : "MYR",
      );
      setCategory(r.category ?? "other");
      setReceiptDate(r.receipt_date ?? "");
      setNotes(r.notes ?? "");
      setPreviewKey(String(Date.now()));
      setAiScanHint(null);
    }

    hydrateForm();
    return () => {
      cancelled = true;
    };
  }, [receipt?.id, open]);

  if (!open || !receipt) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = amount.trim() ? Number(amount) : null;
    onSave({
      merchant: merchant.trim(),
      amount: value != null && Number.isFinite(value) ? value : null,
      currency,
      category,
      receipt_date: receiptDate,
      notes: notes.trim(),
    });
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !receipt) return;

    setReplacing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/finance/receipts/${receipt.id}/file`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) return;

      if (data.receipt) {
        onReceiptReplaced?.(data.receipt);
        setPreviewKey(String(Date.now()));
      }
      if (data.scan) {
        applyScanToForm(data.scan, {
          setMerchant,
          setAmount,
          setCurrency,
          setCategory,
          setReceiptDate,
          setNotes,
        });
      }
    } finally {
      setReplacing(false);
    }
  }

  async function handleAiRescan() {
    if (!receipt) return;
    setAiScanning(true);
    setAiScanHint(null);
    try {
      const res = await fetch(`/api/finance/receipts/${receipt.id}/rescan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setAiScanHint(data.error ?? t("finance.aiRescanFailed"));
        return;
      }
      if (data.scan) {
        applyScanToForm(data.scan, {
          setMerchant,
          setAmount,
          setCurrency,
          setCategory,
          setReceiptDate,
          setNotes,
        });
      }
      setAiScanHint(
        data.scanError
          ? t("finance.aiRescanPartial")
          : t("finance.aiRescanDone", { provider: data.visionProvider ?? "AI" }),
      );
    } finally {
      setAiScanning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-card-border bg-[#0c0c10] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-edit-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-card-border px-5 py-4">
          <div>
            <h2 id="receipt-edit-title" className="text-lg font-semibold text-foreground">
              {isNewUpload ? t("finance.confirmReceipt") : t("finance.editReceipt")}
            </h2>
            {isNewUpload ? (
              <p className="mt-0.5 text-xs text-muted">{t("finance.confirmReceiptDesc")}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-foreground"
            aria-label={t("common.cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-2">
            <ReceiptPreview
              receiptId={receipt.id}
              mimeType={receipt.mime_type}
              alt={receipt.merchant ?? "Receipt"}
              className="max-h-48 w-full rounded-lg border border-card-border bg-black/40 object-contain"
              cacheKey={previewKey}
            />
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/finance/receipts/${receipt.id}?download=1`}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                {t("finance.downloadReceipt")}
              </a>
              <button
                type="button"
                onClick={handleAiRescan}
                disabled={aiScanning || replacing}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                {aiScanning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ScanLine className="h-3.5 w-3.5" />
                )}
                {t("finance.aiRescan")}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={replacing || aiScanning}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground hover:underline disabled:opacity-50"
              >
                {replacing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                {t("finance.replaceReceiptFile")}
              </button>
            </div>
            {aiScanHint ? <p className="text-xs text-muted">{aiScanHint}</p> : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={handleReplaceFile}
            />
          </div>

          <label className="block text-xs text-muted">
            {t("finance.merchant")}
            <input
              className={`${inputClass} mt-1`}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={t("finance.merchantPlaceholder")}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              {t("finance.amount")}
              <input
                type="number"
                step="0.01"
                min="0"
                className={`${inputClass} mt-1`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="block text-xs text-muted">
              {t("finance.currency")}
              <select
                className={`${inputClass} mt-1`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as FinanceCurrency)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-muted">
            {t("finance.category")}
            <select
              className={`${inputClass} mt-1`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.expense.${categoryKey(c)}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-muted">
            {t("finance.receiptDate")}
            <input
              type="date"
              className={`${inputClass} mt-1`}
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </label>

          <label className="block text-xs text-muted">
            {t("finance.receiptNotes")}
            <textarea
              className={`${inputClass} mt-1 min-h-[72px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("finance.receiptNotesPlaceholder")}
            />
          </label>

          {receipt.transaction_id ? (
            <p className="text-xs text-muted">{t("finance.editReceiptSyncHint")}</p>
          ) : null}
          </div>

          {saveError ? (
            <p className="shrink-0 border-t border-danger/30 bg-danger/10 px-5 py-2 text-sm text-danger">
              {saveError}
            </p>
          ) : null}

          <div className="flex shrink-0 justify-end gap-2 border-t border-card-border px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:text-foreground">
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
