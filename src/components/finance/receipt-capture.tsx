"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  ImagePlus,
  FileText,
  Loader2,
  Pencil,
  ScanLine,
  Trash2,
  Upload,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { ReceiptEditDialog } from "@/components/finance/receipt-edit-dialog";
import { ReceiptPreview } from "@/components/finance/receipt-preview";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDateLocalized } from "@/lib/i18n";
import { buildReceiptDownloadName } from "@/lib/finance/receipt-files";
import { formatCurrency } from "@/lib/utils";
import type { FinanceReceipt } from "@/types/finance";

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted hover:text-foreground";

export function ReceiptCapturePanel({ onChange }: { onChange: () => void }) {
  const { t, locale } = useLocale();
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [autoExpense, setAutoExpense] = useState(true);
  const [driveReady, setDriveReady] = useState(false);
  const [scanReady, setScanReady] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastResultError, setLastResultError] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<FinanceReceipt | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmNewUpload, setConfirmNewUpload] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, statusRes] = await Promise.all([
        fetch(`/api/finance/receipts?t=${Date.now()}`, { cache: "no-store" }),
        fetch("/api/finance/receipts/status", { cache: "no-store" }),
      ]);
      const [recData, statusData] = await Promise.all([recRes.json(), statusRes.json()]);
      setReceipts(recData.receipts ?? []);
      setDriveReady(Boolean(statusData.driveConfigured));
      setScanReady(Boolean(statusData.visionConfigured ?? statusData.llmConfigured));
    } finally {
      setLoading(false);
    }
  }, []);

  async function openReceiptEdit(receipt: FinanceReceipt) {
    setEditSaveError(null);
    setConfirmNewUpload(false);
    try {
      const res = await fetch(`/api/finance/receipts/${receipt.id}/info`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setEditingReceipt(data.receipt ?? receipt);
        return;
      }
    } catch {
      // fall back to list item
    }
    setEditingReceipt(receipt);
  }

  useEffect(() => {
    load();
    return () => stopCamera();
  }, [load]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      fileInputRef.current?.click();
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      stopCamera();
      await uploadFile(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setLastResult(null);
    setLastResultError(false);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("auto_expense", String(autoExpense));

      const res = await fetch("/api/finance/receipts", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setLastResult(data.error ?? t("finance.receiptFailed"));
        setLastResultError(true);
        return;
      }

      const parts: string[] = [t("finance.receiptSaved")];
      if (data.scan?.merchant) parts.push(data.scan.merchant);
      if (data.scan?.amount) {
        parts.push(formatCurrency(data.scan.amount, data.scan.currency ?? "MYR"));
      }
      if (data.scanError) parts.push(t("finance.receiptScanManual"));
      if (data.driveUploaded) parts.push(t("finance.driveUploaded"));
      if (data.transactionCreated) parts.push(t("finance.expenseCreated"));
      setLastResult(parts.join(" · "));
      setLastResultError(false);

      if (data.receipt) {
        setEditingReceipt(data.receipt);
        setConfirmNewUpload(true);
      }

      load();
      onChange();
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    e.target.value = "";
  }

  async function createExpense(receipt: FinanceReceipt) {
    await fetch(`/api/finance/receipts/${receipt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ create_expense: true }),
    });
    load();
    onChange();
  }

  async function triggerReceiptDownload(
    receipt: FinanceReceipt,
    kind: "original" | "summary",
  ) {
    const url =
      kind === "summary"
        ? `/api/finance/receipts/${receipt.id}/summary`
        : `/api/finance/receipts/${receipt.id}?download=1`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      setLastResult(t("finance.receiptDownloadFailed"));
      setLastResultError(true);
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const utfMatch = cd.match(/filename\*=UTF-8''([^;]+)/i);
    const plainMatch = cd.match(/filename="([^"]+)"/i);
    const fallback =
      kind === "summary"
        ? buildReceiptDownloadName(receipt).replace(/\.pdf$/i, "_summary.pdf")
        : buildReceiptDownloadName(receipt);
    const filename = utfMatch
      ? decodeURIComponent(utfMatch[1])
      : (plainMatch?.[1] ?? fallback);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function deleteReceipt(id: string) {
    await fetch(`/api/finance/receipts/${id}`, { method: "DELETE" });
    load();
  }

  async function saveReceiptEdit(patch: {
    merchant: string;
    amount: number | null;
    currency: string;
    category: string;
    receipt_date: string;
    notes: string;
  }) {
    if (!editingReceipt) return;
    setSavingEdit(true);
    setLastResult(null);
    setLastResultError(false);
    setEditSaveError(null);
    try {
      const res = await fetch(`/api/finance/receipts/${editingReceipt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : t("finance.receiptUpdateFailed");
        setEditSaveError(msg);
        setLastResult(msg);
        setLastResultError(true);
        return;
      }
      const saved = data.receipt as FinanceReceipt | undefined;
      if (saved) {
        setReceipts((prev) =>
          prev.map((r) => (r.id === saved.id ? saved : r)),
        );
      }
      setLastResult(t("finance.receiptUpdated"));
      setEditingReceipt(null);
      setConfirmNewUpload(false);
      load();
      onChange();
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={t("finance.receiptCapture")}
          description={t("finance.receiptCaptureDesc")}
        />
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant={scanReady ? "success" : "muted"}>
              <ScanLine className="mr-1 inline h-3 w-3" />
              {scanReady ? t("finance.autoScanReady") : t("finance.autoScanOff")}
            </Badge>
            <Badge variant={driveReady ? "success" : "muted"}>
              <Upload className="mr-1 inline h-3 w-3" />
              {driveReady ? t("finance.driveReady") : t("finance.driveNotConfigured")}
            </Badge>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={autoExpense}
              onChange={(e) => setAutoExpense(e.target.checked)}
              className="rounded border-card-border"
            />
            {t("finance.autoCreateExpense")}
          </label>

          {cameraOn ? (
            <div className="space-y-3">
              <video
                ref={videoRef}
                className="w-full max-h-72 rounded-lg border border-card-border bg-black object-contain"
                playsInline
                muted
              />
              <div className="flex gap-2">
                <button type="button" onClick={captureFromCamera} disabled={uploading} className={btnPrimary}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {t("finance.captureReceipt")}
                </button>
                <button type="button" onClick={stopCamera} className={btnGhost}>
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={startCamera} disabled={uploading} className={btnPrimary}>
                <Camera className="h-4 w-4" />
                {t("finance.openCamera")}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={btnGhost}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {t("finance.uploadReceipt")}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {lastResult && (
            <p
              className={`flex items-center gap-2 text-sm ${
                lastResultError ? "text-danger" : "text-success"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {lastResult}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("finance.receiptHistory")} description={t("finance.receiptHistoryDesc")} />
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />
        ) : receipts.length === 0 ? (
          <p className="text-sm text-muted">{t("finance.noReceipts")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {receipts.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-lg border border-card-border bg-background/50">
                <ReceiptPreview
                  receiptId={r.id}
                  mimeType={r.mime_type}
                  alt={r.merchant ?? "Receipt"}
                  className="h-36 w-full bg-card"
                />
                <div className="space-y-2 p-3">
                  <p className="font-medium text-foreground">{r.merchant ?? t("finance.unknownMerchant")}</p>
                  <p className="text-sm text-muted">
                    {r.amount ? formatCurrency(r.amount, r.currency ?? "MYR") : "—"}
                    {r.receipt_date ? ` · ${formatDateLocalized(r.receipt_date, locale)}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {r.transaction_id && <Badge variant="success">{t("finance.expenseLinked")}</Badge>}
                    {r.google_drive_url && (
                      <a
                        href={r.google_drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        Google Drive <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => triggerReceiptDownload(r, "summary")}
                      className={btnGhost}
                      title={t("finance.downloadSummaryReceipt")}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerReceiptDownload(r, "original")}
                      className={btnGhost}
                      title={t("finance.downloadReceipt")}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openReceiptEdit(r)}
                      className={btnGhost}
                      title={t("finance.editReceipt")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!r.transaction_id && r.amount && (
                      <button type="button" onClick={() => createExpense(r)} className={btnGhost}>
                        {t("finance.createExpense")}
                      </button>
                    )}
                    <button type="button" onClick={() => deleteReceipt(r.id)} className={btnGhost}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ReceiptEditDialog
        receipt={editingReceipt}
        open={editingReceipt != null}
        saving={savingEdit}
        isNewUpload={confirmNewUpload}
        onClose={() => {
          setEditingReceipt(null);
          setConfirmNewUpload(false);
          setEditSaveError(null);
        }}
        onSave={saveReceiptEdit}
        saveError={editSaveError}
        onReceiptReplaced={(updated) => setEditingReceipt(updated)}
      />
    </div>
  );
}
