"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { CardHeader } from "@/components/ui/card";
import type { BackupFileMeta } from "@/lib/system/backup";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataBackupPanel() {
  const { t } = useLocale();
  const [meta, setMeta] = useState<BackupFileMeta[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/status");
      const data = await res.json();
      setMeta(data.meta ?? []);
      setTotalBytes(data.totalBytes ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportBackup() {
    setExporting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/system/backup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("settings.backupFailed"));

      const blob = new Blob([JSON.stringify(data.backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.downloadName ?? "axpm-backup.json";
      a.click();
      URL.revokeObjectURL(url);
      setMessage(t("settings.backupExported"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.backupFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function restoreBackup() {
    if (!confirmRestore || !uploadText.trim()) return;
    setRestoring(true);
    setMessage(null);
    setError(null);
    try {
      const backup = JSON.parse(uploadText) as Record<string, unknown>;
      const res = await fetch("/api/system/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("settings.restoreFailed"));
      setMessage(t("settings.restoreSuccess", { n: data.count ?? 0 }));
      setUploadText("");
      setConfirmRestore(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.restoreFailed"));
    } finally {
      setRestoring(false);
    }
  }

  async function onFilePick(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setUploadText(text);
    setConfirmRestore(false);
  }

  return (
    <div>
      <CardHeader title={t("settings.backupTitle")} description={t("settings.backupDesc")} />
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : (
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-muted">
            {t("settings.backupSummary", {
              count: meta.filter((f) => f.exists).length,
              size: formatBytes(totalBytes),
            })}
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-card-border bg-background/50 px-3 py-2 text-xs text-muted">
            {meta.map((file) => (
              <li key={file.name} className="flex justify-between gap-2">
                <span className={file.exists ? "text-foreground" : "line-through opacity-50"}>
                  data/{file.name}
                </span>
                <span>{file.exists ? formatBytes(file.bytes) : "—"}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exporting}
              onClick={() => void exportBackup()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t("settings.backupDownload")}
            </button>
          </div>
          <div className="rounded-lg border border-dashed border-card-border p-3 space-y-3">
            <p className="text-xs font-medium text-foreground">{t("settings.restoreTitle")}</p>
            <p className="text-xs text-muted">{t("settings.restoreDesc")}</p>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => void onFilePick(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-card-border file:bg-background file:px-3 file:py-1.5 file:text-xs"
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={confirmRestore}
                onChange={(e) => setConfirmRestore(e.target.checked)}
                className="rounded border-card-border"
              />
              {t("settings.restoreConfirm")}
            </label>
            <button
              type="button"
              disabled={restoring || !confirmRestore || !uploadText.trim()}
              onClick={() => void restoreBackup()}
              className="inline-flex items-center gap-2 rounded-lg border border-card-border px-3 py-2 text-xs hover:bg-card-border/30 disabled:opacity-50"
            >
              {restoring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {t("settings.restoreBtn")}
            </button>
          </div>
          {message && <p className="text-xs text-success">{message}</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
