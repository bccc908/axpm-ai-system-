"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Loader2, Upload } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { CardHeader } from "@/components/ui/card";

type SupabaseStatus = {
  config: {
    configured: boolean;
    canImport: boolean;
    hasServiceKey: boolean;
    url: string | null;
  };
  connected: boolean;
  counts: Record<string, number | null> | null;
  error?: string;
};

export function SupabaseImportPanel() {
  const { t } = useLocale();
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/supabase");
      const data = await res.json();
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runImport() {
    if (!confirmImport) return;
    setImporting(true);
    setMessage(null);
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch("/api/system/supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("settings.supabaseImportFailed"));
      const total = Object.values(data.counts ?? {}).reduce(
        (sum: number, n) => sum + (typeof n === "number" ? n : 0),
        0,
      );
      setMessage(t("settings.supabaseImportSuccess", { n: total }));
      setWarnings(data.warnings ?? []);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.supabaseImportFailed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <CardHeader title={t("settings.supabaseTitle")} description={t("settings.supabaseDesc")} />
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg border border-card-border bg-background/50 px-3 py-2 text-xs">
            <p>
              <span className="text-muted">{t("settings.supabaseUrl")}: </span>
              <code>{status?.config.url ?? "—"}</code>
            </p>
            <p className="mt-1">
              <span className="text-muted">{t("settings.supabaseServiceKey")}: </span>
              {status?.config.hasServiceKey ? t("settings.supabaseSet") : t("settings.supabaseMissing")}
            </p>
            <p className="mt-1">
              <span className="text-muted">{t("settings.supabaseConnection")}: </span>
              {status?.connected ? (
                <span className="text-success">{t("settings.supabaseConnected")}</span>
              ) : (
                <span className="text-warning">{status?.error ?? t("settings.supabaseNotConnected")}</span>
              )}
            </p>
          </div>

          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted">
            <li>{t("settings.supabaseStep1")}</li>
            <li>{t("settings.supabaseStep2")}</li>
            <li>{t("settings.supabaseStep3")}</li>
          </ol>

          {status?.counts && status.connected && (
            <div className="rounded-lg border border-card-border px-3 py-2 text-xs text-muted">
              <p className="mb-1 font-medium text-foreground">{t("settings.supabaseCounts")}</p>
              <ul className="space-y-0.5">
                {Object.entries(status.counts).map(([table, count]) => (
                  <li key={table} className="flex justify-between gap-2">
                    <span>{table}</span>
                    <span>{count ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status?.config.canImport && (
            <div className="rounded-lg border border-dashed border-card-border p-3 space-y-3">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmImport}
                  onChange={(e) => setConfirmImport(e.target.checked)}
                  className="rounded border-card-border"
                />
                {t("settings.supabaseImportConfirm")}
              </label>
              <button
                type="button"
                disabled={importing || !confirmImport || !status.connected}
                onClick={() => void runImport()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {t("settings.supabaseImportBtn")}
              </button>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Database className="h-3.5 w-3.5" />
                {t("settings.supabaseImportNote")}
              </p>
            </div>
          )}

          {message && <p className="text-xs text-success">{message}</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
          {warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-warning">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
