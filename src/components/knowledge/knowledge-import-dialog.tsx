"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { KNOWLEDGE_FILE_ACCEPT, KNOWLEDGE_FILE_MAX_BYTES, knowledgeFileMime } from "@/lib/knowledge-base/file-types";
import { inferKnowledgeSection, splitMarkdownNote } from "@/lib/knowledge-base/routing";
import { KNOWLEDGE_SECTIONS, type KnowledgeSectionId } from "@/lib/knowledge-base/sections";
import { cn } from "@/lib/utils";

type DriveFile = {
  id: string;
  name: string;
  folderPath: string;
  suggestedSection: KnowledgeSectionId | null;
  webViewLink: string | null;
};

type DriveStatus = {
  connected: boolean;
  serviceAccountEmail: string | null;
  folder: { id: string; url: string; label: string } | null;
  files: DriveFile[];
  skippedSpreadsheets: number;
  code: "not_connected" | "no_folder" | "ready" | "list_failed";
  error?: string | null;
};

type ObsidianSettings = {
  vaultName: string;
  localPathLabel: string;
  readsLocalVault: false;
};

type LocalFile = {
  file: File;
  relativePath: string;
  section: KnowledgeSectionId | "";
};

const fieldClass = "input-premium w-full rounded-md px-3 py-2 text-sm";

export function KnowledgeImportDialog({
  tab,
  onClose,
  onImported,
}: {
  tab: "google_drive" | "obsidian";
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useLocale();
  const titleId = useId();
  const [active, setActive] = useState(tab);
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [obsidian, setObsidian] = useState<ObsidianSettings | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [vaultName, setVaultName] = useState("");
  const [pathLabel, setPathLabel] = useState("");
  const [driveSection, setDriveSection] = useState<KnowledgeSectionId | "">("");
  const [obsidianSection, setObsidianSection] = useState<KnowledgeSectionId | "">("");
  const [selected, setSelected] = useState<Record<string, KnowledgeSectionId | "">>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [driveLinks, setDriveLinks] = useState("");
  const [obsidianLinks, setObsidianLinks] = useState("");
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/knowledge-base/imports/google-drive", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as DriveStatus;
        if (cancelled || !res.ok) return;
        setDrive(body);
        if (body.folder?.url) setFolderInput(body.folder.url);
        const next: Record<string, KnowledgeSectionId | ""> = {};
        for (const file of body.files ?? []) next[file.id] = file.suggestedSection ?? "";
        setSelected(next);
      })
      .catch(() => undefined);
    void fetch("/api/knowledge-base/imports/obsidian", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as ObsidianSettings;
        if (cancelled || !res.ok) return;
        setObsidian(body);
        setVaultName(body.vaultName ?? "");
        setPathLabel(body.localPathLabel ?? "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveFolder() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/knowledge-base/imports/google-drive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: folderInput.trim(), label: "Staff library" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : t("knowledge.importFailed"));
      setDrive(body as DriveStatus);
      setNotice(body.connected ? t("knowledge.folderSavedConnected") : t("knowledge.folderSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function clearFolder() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge-base/imports/google-drive", { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : t("knowledge.importFailed"));
      setDrive(body as DriveStatus);
      setFolderInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveObsidian() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/knowledge-base/imports/obsidian", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultName, localPathLabel: pathLabel }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : t("knowledge.importFailed"));
      setObsidian(body as ObsidianSettings);
      setNotice(t("knowledge.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function importLinks(provider: "google_drive" | "obsidian", raw: string, section: KnowledgeSectionId | "") {
    const links = raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (links.length === 0 || !section) {
      setError(t("knowledge.linkInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge-base/imports/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, section, links }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : t("knowledge.importFailed"));
      const count = Array.isArray(body.articles) ? body.articles.length : 0;
      if (count === 0) throw new Error(t("knowledge.importFailed"));
      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function importDriveFiles() {
    const items = (drive?.files ?? [])
      .filter((file) => checked[file.id])
      .map((file) => ({ fileId: file.id, section: selected[file.id] || "" }));
    if (items.length === 0 || items.some((item) => !item.section)) {
      setError(t("knowledge.noDriveSelection"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge-base/imports/google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : t("knowledge.importFailed"));
      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onLocalFiles(list: FileList | null) {
    const next: LocalFile[] = [];
    for (const file of [...(list ?? [])]) {
      if (!knowledgeFileMime(file.name, file.type)) {
        setError(t("knowledge.fileRejected"));
        continue;
      }
      if (file.size > KNOWLEDGE_FILE_MAX_BYTES) {
        setError(t("knowledge.fileTooLarge"));
        continue;
      }
      const relativePath = file.webkitRelativePath || file.name;
      let section: KnowledgeSectionId | "" = inferKnowledgeSection(relativePath) ?? "";
      if (!section && /\.(md|markdown|txt)$/i.test(file.name)) {
        const text = await file.slice(0, 4000).text();
        const note = splitMarkdownNote(text);
        section = inferKnowledgeSection(note.section, note.title, relativePath) ?? "";
      }
      next.push({ file, relativePath, section });
    }
    setLocalFiles(next);
  }

  async function importLocalFiles() {
    if (localFiles.length === 0 || localFiles.some((item) => !item.section)) {
      setError(t("knowledge.noDriveSelection"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set(
        "manifest",
        JSON.stringify({
          vaultName,
          items: localFiles.map((item) => ({
            fileName: item.file.name,
            relativePath: item.relativePath,
            section: item.section,
          })),
        }),
      );
      for (const item of localFiles) form.append("file", item.file);
      const res = await fetch("/api/knowledge-base/imports/obsidian", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : t("knowledge.importFailed"));
      const count = Array.isArray(body.articles) ? body.articles.length : 0;
      if (count === 0) throw new Error(t("knowledge.importFailed"));
      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("knowledge.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  function sectionSelect(
    value: KnowledgeSectionId | "",
    onChange: (value: KnowledgeSectionId | "") => void,
    label: string,
    id: string,
  ) {
    return (
      <label className="block" htmlFor={id}>
        <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as KnowledgeSectionId | "")}
          className={fieldClass}
        >
          <option value="">{t("knowledge.chooseSection")}</option>
          {KNOWLEDGE_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.zh} / {section.en}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const driveConnected = drive?.connected === true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 md:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-panel relative z-10 my-auto w-full max-w-3xl rounded-lg p-4 md:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {t("knowledge.importTitle")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{t("knowledge.importHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-card-border p-1.5 text-muted hover:text-foreground"
            aria-label={t("knowledge.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {(["google_drive", "obsidian"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={active === value}
              onClick={() => {
                setActive(value);
                setError(null);
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[13px]",
                active === value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-card-border text-muted hover:text-foreground",
              )}
            >
              {value === "google_drive" ? t("knowledge.driveTab") : t("knowledge.obsidianTab")}
            </button>
          ))}
        </div>

        {active === "google_drive" ? (
          <div className="mt-4 space-y-4">
            <div
              className={cn(
                "rounded-md border px-3 py-3 text-sm leading-6",
                driveConnected ? "border-secondary/40 bg-secondary/10" : "border-accent/40 bg-accent/10",
              )}
            >
              <p className="font-medium text-foreground">
                {driveConnected ? t("knowledge.driveConnectedTitle") : t("knowledge.connectDriveTitle")}
              </p>
              <p className="mt-1 text-foreground/85">
                {driveConnected ? t("knowledge.driveConnectedBody") : t("knowledge.connectDriveBody")}
              </p>
              {drive?.serviceAccountEmail ? (
                <p className="mt-2 text-[13px] text-foreground">
                  {t("knowledge.serviceAccount")}: {drive.serviceAccountEmail}
                </p>
              ) : null}
              <Link href={"/dashboard/google-drive" as Route} className="mt-2 inline-block text-[13px] text-accent">
                {t("knowledge.openDrivePage")}
              </Link>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block min-w-0 flex-1">
                <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.driveFolderLabel")}</span>
                <input
                  id="knowledge-drive-folder"
                  value={folderInput}
                  onChange={(event) => setFolderInput(event.target.value)}
                  placeholder={t("knowledge.driveFolderPlaceholder")}
                  className={fieldClass}
                />
              </label>
              <button type="button" disabled={busy} onClick={() => void saveFolder()} className="btn-premium rounded-md px-3 py-2 text-sm disabled:opacity-50">
                {t("knowledge.saveFolder")}
              </button>
              {drive?.folder ? (
                <button type="button" disabled={busy} onClick={() => void clearFolder()} className="rounded-md border border-card-border px-3 py-2 text-sm text-muted">
                  {t("knowledge.removeFolder")}
                </button>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-md border border-card-border">
              <div className="grid grid-cols-[1.4rem_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-2 border-b border-card-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                <span />
                <span>File</span>
                <span>Folder</span>
                <span>{t("knowledge.sectionLabel")}</span>
              </div>
              {(drive?.files.length ?? 0) === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">
                  {drive?.code === "no_folder" ? t("knowledge.driveNoFolder") : t("knowledge.driveEmpty")}
                </p>
              ) : (
                <ul className="max-h-64 divide-y divide-card-border overflow-y-auto">
                  {drive?.files.map((file) => (
                    <li key={file.id} className="grid grid-cols-[1.4rem_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(checked[file.id])}
                        onChange={(event) => setChecked((current) => ({ ...current, [file.id]: event.target.checked }))}
                        aria-label={file.name}
                      />
                      <span className="truncate text-[13px] text-foreground">{file.name}</span>
                      <span className="truncate text-[12px] text-muted">{file.folderPath || "—"}</span>
                      <select
                        value={selected[file.id] ?? ""}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [file.id]: event.target.value as KnowledgeSectionId | "",
                          }))
                        }
                        className="input-premium rounded-md px-2 py-1 text-[12px]"
                      >
                        <option value="">{t("knowledge.chooseSection")}</option>
                        {KNOWLEDGE_SECTIONS.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.zh}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {drive?.skippedSpreadsheets ? (
              <p className="text-[12px] text-muted">
                {t("knowledge.skippedSpreadsheets", { count: drive.skippedSpreadsheets })}
              </p>
            ) : (
              <p className="text-[12px] text-muted">{t("knowledge.spreadsheetNote")}</p>
            )}
            <button
              type="button"
              disabled={busy || !driveConnected}
              onClick={() => void importDriveFiles()}
              className="btn-premium rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              {t("knowledge.importSelected")}
            </button>

            <div className="border-t border-card-border pt-4">
              <p className="mb-2 text-sm font-medium text-foreground">{t("knowledge.pasteLinks")}</p>
              {sectionSelect(driveSection, setDriveSection, t("knowledge.sectionForUnclear"), "knowledge-drive-section")}
              <textarea
                id="knowledge-drive-links"
                value={driveLinks}
                onChange={(event) => setDriveLinks(event.target.value)}
                rows={4}
                placeholder={t("knowledge.pasteDrivePlaceholder")}
                className={`${fieldClass} mt-3 min-h-24`}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void importLinks("google_drive", driveLinks, driveSection)}
                className="mt-3 rounded-md border border-card-border px-3 py-2 text-sm text-foreground hover:border-border-strong"
              >
                {t("knowledge.importLinks")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="rounded-md border border-secondary/40 bg-secondary/10 px-3 py-3 text-sm leading-6 text-foreground">
              {t("knowledge.obsidianLocalNote")}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.vaultName")}</span>
                <input value={vaultName} onChange={(event) => setVaultName(event.target.value)} maxLength={80} className={fieldClass} />
                <span className="mt-1 block text-[12px] text-muted">{t("knowledge.vaultNameHint")}</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.vaultPath")}</span>
                <input
                  id="knowledge-obsidian-path"
                  value={pathLabel}
                  onChange={(event) => setPathLabel(event.target.value)}
                  maxLength={300}
                  placeholder={obsidian?.localPathLabel || ""}
                  className={fieldClass}
                />
                <span className="mt-1 block text-[12px] text-muted">{t("knowledge.vaultPathHint")}</span>
              </label>
            </div>
            <button type="button" disabled={busy} onClick={() => void saveObsidian()} className="rounded-md border border-card-border px-3 py-2 text-sm text-foreground">
              {t("knowledge.saveObsidian")}
            </button>

            <div className="border-t border-card-border pt-4">
              <p className="text-sm font-medium text-foreground">{t("knowledge.uploadFiles")}</p>
              <p className="mt-1 text-[13px] leading-5 text-muted">{t("knowledge.uploadHint")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="rounded-md border border-card-border px-3 py-2 text-sm text-foreground">
                  {t("knowledge.uploadFiles")}
                  <input
                    id="knowledge-obsidian-files"
                    type="file"
                    multiple
                    accept={KNOWLEDGE_FILE_ACCEPT}
                    className="sr-only"
                    onChange={(event) => void onLocalFiles(event.target.files)}
                  />
                </label>
                <label className="rounded-md border border-card-border px-3 py-2 text-sm text-foreground">
                  {t("knowledge.uploadFolder")}
                  <input
                    id="knowledge-obsidian-folder"
                    type="file"
                    multiple
                    className="sr-only"
                    ref={(node) => {
                      node?.setAttribute("webkitdirectory", "");
                      node?.setAttribute("directory", "");
                    }}
                    onChange={(event) => void onLocalFiles(event.target.files)}
                  />
                </label>
              </div>
              {localFiles.length > 0 ? (
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {localFiles.map((item, index) => (
                    <li key={`${item.relativePath}:${index}`} className="grid gap-2 rounded-md border border-card-border px-3 py-2 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
                      <span className="truncate text-[13px] text-foreground">{item.relativePath}</span>
                      <select
                        value={item.section}
                        aria-label={item.file.name}
                        onChange={(event) => {
                          const section = event.target.value as KnowledgeSectionId | "";
                          setLocalFiles((current) =>
                            current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, section } : entry)),
                          );
                        }}
                        className="input-premium rounded-md px-2 py-1 text-[12px]"
                      >
                        <option value="">{t("knowledge.chooseSection")}</option>
                        {KNOWLEDGE_SECTIONS.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.zh} / {section.en}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">{t("knowledge.driveEmpty")}</p>
              )}
              <button type="button" disabled={busy} onClick={() => void importLocalFiles()} className="btn-premium mt-3 rounded-md px-3 py-2 text-sm disabled:opacity-50">
                {t("knowledge.importFiles")}
              </button>
            </div>

            <div className="border-t border-card-border pt-4">
              <p className="mb-2 text-sm font-medium text-foreground">{t("knowledge.pasteLinks")}</p>
              {sectionSelect(obsidianSection, setObsidianSection, t("knowledge.sectionForUnclear"), "knowledge-obsidian-section")}
              <textarea
                id="knowledge-obsidian-links"
                value={obsidianLinks}
                onChange={(event) => setObsidianLinks(event.target.value)}
                rows={4}
                placeholder={t("knowledge.pasteObsidianPlaceholder")}
                className={`${fieldClass} mt-3 min-h-24`}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void importLinks("obsidian", obsidianLinks, obsidianSection)}
                className="mt-3 rounded-md border border-card-border px-3 py-2 text-sm text-foreground"
              >
                {t("knowledge.importLinks")}
              </button>
            </div>
          </div>
        )}

        {notice ? <p className="mt-3 text-sm text-foreground">{notice}</p> : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {busy ? <p className="mt-3 text-sm text-muted">{t("common.loading")}</p> : null}
      </div>
    </div>
  );
}
