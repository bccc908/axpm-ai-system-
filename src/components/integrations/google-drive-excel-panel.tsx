"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Calculator,
  ExternalLink,
  FileSpreadsheet,
  FolderPlus,
  Loader2,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type DriveExcelFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: number | null;
  webViewLink: string | null;
  kind: "excel" | "google-sheet";
  folderId?: string;
};

type DriveFolder = {
  id: string;
  label: string;
};

type DriveConfig = {
  excelConfigured: boolean;
  excelFolderIdSet: boolean;
  excelFolderCount?: number;
  serviceAccountEmail: string | null;
};

type ParsedSheet = {
  name: string;
  headers: string[];
  rows: Record<string, string | number | null>[];
  rowCount: number;
};

type CommissionRow = {
  index: number;
  client: string;
  profit: number | null;
  rate: number | null;
  splitInSheet: number | null;
  computedSplit: number | null;
  effectiveSplit: number;
  raw: Record<string, string | number | null>;
};

type CommissionResult = {
  rows: CommissionRow[];
  summary: {
    totalProfit: number;
    totalSplit: number;
    rowCount: number;
    clientCount: number;
    byClient: { client: string; profit: number; split: number; trades: number }[];
  };
  detectedColumns: {
    client: string | null;
    profit: string | null;
    rate: string | null;
    split: string | null;
    lots: string | null;
  };
  defaultRateUsed: number | null;
};

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string | null, locale: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatMoney(n: number | null | undefined, locale: string) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRate(rate: number | null) {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;
}

export function GoogleDriveExcelPanel() {
  const { t, locale } = useLocale();
  const [config, setConfig] = useState<DriveConfig | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveExcelFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [commission, setCommission] = useState<CommissionResult | null>(null);
  const [defaultRate, setDefaultRate] = useState("30");
  const [view, setView] = useState<"byClient" | "detail">("byClient");
  const [newFolderUrl, setNewFolderUrl] = useState("");
  const [newFolderLabel, setNewFolderLabel] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);

  const load = useCallback(
    async (folderId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
        const res = await fetch(`/api/integrations/google-drive/excel${params}`);
        const data = await res.json();
        setConfig(data.config ?? null);
        setFolders(data.folders ?? []);
        setFiles(data.files ?? []);
        setActiveFolderId(data.activeFolderId ?? data.folders?.[0]?.id ?? null);
        if (!res.ok && data.error) setError(data.error);
        else if (!data.folders?.length) setError(t("googleDriveExcel.noFolders"));
        else if (!data.config?.excelConfigured && !data.folders?.length) {
          setError(t("googleDriveExcel.notConfigured"));
        }
      } catch {
        setError(t("googleDriveExcel.loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  async function addFolder() {
    if (!newFolderUrl.trim()) return;
    setAddingFolder(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google-drive/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: newFolderUrl.trim(),
          label: newFolderLabel.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("googleDriveExcel.addFolderFailed"));
      setFolders(data.folders ?? []);
      setNewFolderUrl("");
      setNewFolderLabel("");
      const nextId = data.folders?.at(-1)?.id;
      if (nextId) await load(nextId);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("googleDriveExcel.addFolderFailed"));
    } finally {
      setAddingFolder(false);
    }
  }

  async function removeFolder(folderId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/google-drive/excel?folderId=${encodeURIComponent(folderId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("googleDriveExcel.removeFolderFailed"));
      setFolders(data.folders ?? []);
      const nextId = data.folders?.[0]?.id;
      setSelectedId(null);
      setCommission(null);
      if (nextId) await load(nextId);
      else {
        setFiles([]);
        setActiveFolderId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("googleDriveExcel.removeFolderFailed"));
    }
  }

  const loadFile = useCallback(
    async (file: DriveExcelFile, sheet?: string) => {
      setSelectedId(file.id);
      setPreviewLoading(true);
      setPreviewError(null);
      setCommission(null);
      setFileName(file.name);
      try {
        const rate = Number(defaultRate);
        const params = new URLSearchParams({
          mimeType: file.mimeType,
        });
        if (sheet) params.set("sheet", sheet);
        if (Number.isFinite(rate) && rate > 0) params.set("defaultRate", String(rate));

        const res = await fetch(`/api/integrations/google-drive/excel/${file.id}?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("googleDriveExcel.previewFailed"));
        setSheets(data.sheets ?? []);
        setActiveSheet(sheet ?? data.sheets?.[0]?.name ?? null);
        setFileName(data.fileName ?? file.name);
        setCommission(data.commission ?? null);
      } catch (e) {
        setPreviewError(e instanceof Error ? e.message : t("googleDriveExcel.previewFailed"));
      } finally {
        setPreviewLoading(false);
      }
    },
    [defaultRate, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedFile = files.find((f) => f.id === selectedId) ?? null;
  const active = sheets.find((s) => s.name === activeSheet) ?? sheets[0] ?? null;
  const detected = commission?.detectedColumns;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("googleDriveExcel.title")}
        subtitle={t("googleDriveExcel.desc")}
        icon={<Calculator className="h-4 w-4 text-accent" />}
      />

      <Card>
        <CardHeader
          title={t("googleDriveExcel.connection")}
          action={
            <button
              type="button"
              onClick={() => void load(activeFolderId ?? undefined)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted hover:text-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              {t("googleDriveExcel.refresh")}
            </button>
          }
        />
        <div className="space-y-2 px-5 pb-5 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted">
            <span>
              {t("googleDriveExcel.status")}:{" "}
              <span className={config?.excelConfigured ? "text-emerald-400" : "text-amber-400"}>
                {config?.excelConfigured
                  ? t("googleDriveExcel.connected")
                  : t("googleDriveExcel.disconnected")}
              </span>
            </span>
            {config?.serviceAccountEmail ? (
              <span className="font-mono text-xs">{config.serviceAccountEmail}</span>
            ) : null}
          </div>
          {!config?.excelConfigured && folders.length === 0 ? (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100/90">
              {t("googleDriveExcel.setupHint")}
            </p>
          ) : null}
          {folders.length > 0 ? (
            <p className="text-xs text-muted">
              {t("googleDriveExcel.folderCount", { n: folders.length })}
            </p>
          ) : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("googleDriveExcel.foldersTitle")} />
        <div className="space-y-3 px-5 pb-5">
          {folders.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-xl border px-2 py-1",
                    activeFolderId === folder.id
                      ? "border-accent/35 bg-accent/10"
                      : "border-white/[0.08] bg-black/20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setCommission(null);
                      void load(folder.id);
                    }}
                    className="px-1.5 py-0.5 text-xs font-medium text-foreground"
                  >
                    {folder.label}
                  </button>
                  <button
                    type="button"
                    title={t("googleDriveExcel.removeFolder")}
                    onClick={() => void removeFolder(folder.id)}
                    className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1 text-xs text-muted">
              {t("googleDriveExcel.folderUrl")}
              <input
                value={newFolderUrl}
                onChange={(e) => setNewFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="mt-1 block w-full rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="w-32 text-xs text-muted">
              {t("googleDriveExcel.folderLabel")}
              <input
                value={newFolderLabel}
                onChange={(e) => setNewFolderLabel(e.target.value)}
                placeholder={t("googleDriveExcel.folderLabelPh")}
                className="mt-1 block w-full rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              disabled={addingFolder || !newFolderUrl.trim()}
              onClick={() => void addFolder()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent disabled:opacity-50"
            >
              {addingFolder ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5" />
              )}
              {t("googleDriveExcel.addFolder")}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <Card className="min-h-[420px]">
          <CardHeader
            title={t("googleDriveExcel.fileList")}
            description={
              activeFolderId
                ? folders.find((f) => f.id === activeFolderId)?.label
                : undefined
            }
          />
          <div className="max-h-[560px] overflow-y-auto px-2 pb-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("googleDriveExcel.loading")}
              </div>
            ) : files.length === 0 ? (
              <p className="px-3 py-12 text-center text-sm text-muted">
                {t("googleDriveExcel.empty")}
              </p>
            ) : (
              <ul className="space-y-1">
                {files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => void loadFile(file)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                        selectedId === file.id
                          ? "border-accent/35 bg-accent/10"
                          : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="mt-0.5 text-[10px] text-muted">
                            {formatBytes(file.size)} · {formatTime(file.modifiedTime, locale)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {selectedFile ? (
            <Card>
              <div className="flex flex-wrap items-end gap-3 px-5 pb-4 pt-1">
                <label className="text-xs text-muted">
                  {t("googleDriveExcel.defaultRate")}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(e.target.value)}
                    className="mt-1 block w-24 rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 font-mono text-sm text-foreground"
                  />
                </label>
                <button
                  type="button"
                  disabled={previewLoading}
                  onClick={() => void loadFile(selectedFile, activeSheet ?? undefined)}
                  className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent disabled:opacity-50"
                >
                  {t("googleDriveExcel.recalculate")}
                </button>
                {selectedFile.webViewLink ? (
                  <a
                    href={selectedFile.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Drive
                  </a>
                ) : null}
              </div>
            </Card>
          ) : null}

          {commission ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t("googleDriveExcel.totalProfit")} value={formatMoney(commission.summary.totalProfit, locale)} />
              <StatCard label={t("googleDriveExcel.totalSplit")} value={formatMoney(commission.summary.totalSplit, locale)} accent />
              <StatCard label={t("googleDriveExcel.tradeCount")} value={String(commission.summary.rowCount)} />
              <StatCard label={t("googleDriveExcel.clientCount")} value={String(commission.summary.clientCount)} icon={<Users className="h-3.5 w-3.5" />} />
            </div>
          ) : null}

          <Card className="min-h-[360px]">
            <CardHeader
              title={fileName ?? t("googleDriveExcel.commission")}
              action={
                commission ? (
                  <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-0.5">
                    <TabButton active={view === "byClient"} onClick={() => setView("byClient")}>
                      {t("googleDriveExcel.byClient")}
                    </TabButton>
                    <TabButton active={view === "detail"} onClick={() => setView("detail")}>
                      {t("googleDriveExcel.detail")}
                    </TabButton>
                  </div>
                ) : null
              }
            />

            <div className="px-3 pb-4">
              {!selectedId ? (
                <p className="py-16 text-center text-sm text-muted">{t("googleDriveExcel.pickFile")}</p>
              ) : previewLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("googleDriveExcel.loadingPreview")}
                </div>
              ) : previewError ? (
                <p className="py-8 text-center text-sm text-rose-300">{previewError}</p>
              ) : commission && view === "byClient" ? (
                <div className="space-y-3">
                  {detected ? (
                    <p className="text-[10px] text-muted">
                      {t("googleDriveExcel.detectedCols")}:{" "}
                      {[detected.client, detected.profit, detected.rate, detected.split]
                        .filter(Boolean)
                        .join(" · ") || t("googleDriveExcel.noColsDetected")}
                      {commission.defaultRateUsed != null
                        ? ` · ${t("googleDriveExcel.rateUsed", { rate: formatRate(commission.defaultRateUsed) })}`
                        : null}
                    </p>
                  ) : null}
                  <DataTable
                    headers={[
                      t("googleDriveExcel.colClient"),
                      t("googleDriveExcel.colTrades"),
                      t("googleDriveExcel.colProfit"),
                      t("googleDriveExcel.colSplit"),
                    ]}
                    rows={commission.summary.byClient.map((c) => [
                      c.client,
                      String(c.trades),
                      formatMoney(c.profit, locale),
                      formatMoney(c.split, locale),
                    ])}
                  />
                </div>
              ) : commission && view === "detail" ? (
                <DataTable
                  headers={[
                    "#",
                    detected?.client ?? t("googleDriveExcel.colClient"),
                    detected?.profit ?? t("googleDriveExcel.colProfit"),
                    detected?.rate ?? t("googleDriveExcel.colRate"),
                    t("googleDriveExcel.colSplit"),
                  ]}
                  rows={commission.rows.map((r) => [
                    String(r.index),
                    r.client,
                    formatMoney(r.profit, locale),
                    formatRate(r.rate),
                    formatMoney(r.effectiveSplit, locale),
                  ])}
                />
              ) : active ? (
                <div className="space-y-3">
                  {sheets.length > 1 ? (
                    <div className="flex flex-wrap gap-1">
                      {sheets.map((sheet) => (
                        <button
                          key={sheet.name}
                          type="button"
                          onClick={() => selectedFile && void loadFile(selectedFile, sheet.name)}
                          className={cn(
                            "rounded-md px-2 py-1 font-mono text-[10px]",
                            activeSheet === sheet.name
                              ? "bg-sky-500/15 text-sky-300"
                              : "text-muted hover:bg-white/[0.04]",
                          )}
                        >
                          {sheet.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-sm text-muted">{t("googleDriveExcel.noCommissionData")}</p>
                </div>
              ) : (
                <p className="py-16 text-center text-sm text-muted">{t("googleDriveExcel.noData")}</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
        {icon}
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-lg font-semibold tabular-nums", accent ? "text-accent" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[10px] font-medium",
        active ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-auto rounded-xl border border-white/[0.06]">
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 bg-[#0d1219]">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap border-b border-white/[0.06] px-3 py-2 font-semibold text-foreground/90"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 tabular-nums",
                    j === row.length - 1 ? "font-medium text-accent" : "text-muted",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
