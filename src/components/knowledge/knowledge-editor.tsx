"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { canApproveKnowledge, canEditKnowledge } from "@/lib/knowledge-base/access";
import { KNOWLEDGE_FILE_ACCEPT, KNOWLEDGE_FILE_MAX_BYTES, knowledgeFileMime } from "@/lib/knowledge-base/file-types";
import { parseStaffSourceLink } from "@/lib/knowledge-base/links";
import { KNOWLEDGE_SECTIONS, KNOWLEDGE_STATUSES, type KnowledgeSectionId, type KnowledgeStatus } from "@/lib/knowledge-base/sections";
import type { KnowledgeArticle, KnowledgeAttachment, KnowledgeSourceLink } from "@/lib/knowledge-base/types";

const fieldClass = "input-premium w-full rounded-md px-3 py-2 text-sm";

export function KnowledgeEditor({
  mode,
  article,
  onCancel,
  onSaved,
  onArticleChange,
}: {
  mode: "create" | "edit";
  article?: KnowledgeArticle;
  onCancel?: () => void;
  onSaved?: (article: KnowledgeArticle, demoted: boolean) => void;
  onArticleChange?: (article: KnowledgeArticle) => void;
}) {
  const { t } = useLocale();
  const { user, loading } = useAuth();
  const router = useRouter();
  const canEdit = user ? canEditKnowledge(user.role) : false;
  const canApprove = user ? canApproveKnowledge(user.role) : false;
  const [title, setTitle] = useState(article?.title ?? "");
  const [section, setSection] = useState<KnowledgeSectionId>(article?.section ?? "company_policy");
  const [ownerName, setOwnerName] = useState(article?.ownerName ?? "");
  const [ownerTouched, setOwnerTouched] = useState(Boolean(article?.ownerName));
  const [status, setStatus] = useState<KnowledgeStatus>(article?.status ?? "draft");
  const [body, setBody] = useState(article?.body ?? "");
  const [links, setLinks] = useState<KnowledgeSourceLink[]>(article?.links ?? []);
  const [linkDraft, setLinkDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>(article?.attachments ?? []);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerTouched && mode === "create" && user?.name && ownerName === "") {
      setOwnerName(user.name);
    }
  }, [mode, ownerName, ownerTouched, user]);

  if (loading) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }
  if (!canEdit) {
    return (
      <div className="glass-panel rounded-lg p-5">
        <p className="text-sm text-foreground">{t("knowledge.readOnly")}</p>
        <Link href={"/dashboard/knowledge" as Route} className="mt-3 inline-block text-sm text-accent">
          {t("knowledge.back")}
        </Link>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      title: title.trim(),
      section,
      body: body.trim(),
      ownerName: ownerName.trim() || user?.name || "",
      links: links.map((link) => ({
        id: link.id,
        kind: link.kind,
        url: link.url,
        label: link.label,
      })),
    };
    if (canApprove) payload.status = status;
    try {
      const res = await fetch(
        mode === "create" ? "/api/knowledge-base" : `/api/knowledge-base/${article?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("knowledge.saveFailed"));
        return;
      }
      const saved = (data.article ?? null) as KnowledgeArticle | null;
      if (!saved) {
        setError(t("knowledge.saveFailed"));
        return;
      }
      if (mode === "create") {
        let uploadFailed = false;
        for (const file of pendingFiles) {
          const form = new FormData();
          form.append("file", file);
          const upload = await fetch(`/api/knowledge-base/${saved.id}/attachments`, {
            method: "POST",
            body: form,
          });
          if (!upload.ok) uploadFailed = true;
        }
        if (uploadFailed) {
          setSavedId(saved.id);
          setError(t("knowledge.savedWithUploadError"));
          return;
        }
        router.push(`/dashboard/knowledge/${saved.id}` as Route);
        return;
      }
      onSaved?.(saved, Boolean(data.demoted));
    } catch {
      setError(t("knowledge.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function addLink() {
    const parsed = parseStaffSourceLink(linkDraft);
    if (!parsed.ok) {
      setError(t("knowledge.linkInvalid"));
      return;
    }
    if (links.some((link) => link.url === parsed.link.url)) {
      setLinkDraft("");
      return;
    }
    setLinks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: parsed.link.kind,
        url: parsed.link.url,
        label: parsed.link.label,
      },
    ]);
    setLinkDraft("");
    setError(null);
  }

  function queueFiles(list: FileList | null) {
    const next: File[] = [];
    for (const file of [...(list ?? [])]) {
      if (!knowledgeFileMime(file.name, file.type)) {
        setError(t("knowledge.fileRejected"));
        continue;
      }
      if (file.size > KNOWLEDGE_FILE_MAX_BYTES) {
        setError(t("knowledge.fileTooLarge"));
        continue;
      }
      next.push(file);
    }
    if (mode === "create") {
      setPendingFiles((current) => [...current, ...next].slice(0, 12));
      return;
    }
    void uploadExisting(next);
  }

  async function uploadExisting(files: File[]) {
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      let latest = article;
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/knowledge-base/${article.id}/attachments`, {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.article) {
          setError(typeof data.error === "string" ? data.error : t("knowledge.uploadFailed"));
          break;
        }
        latest = data.article as KnowledgeArticle;
      }
      setAttachments(latest.attachments ?? []);
      onArticleChange?.(latest);
    } catch {
      setError(t("knowledge.uploadFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!article) return;
    setError(null);
    const res = await fetch(`/api/knowledge-base/${article.id}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.article) {
      setError(typeof data.error === "string" ? data.error : t("knowledge.uploadFailed"));
      return;
    }
    const latest = data.article as KnowledgeArticle;
    setAttachments(latest.attachments ?? []);
    onArticleChange?.(latest);
  }

  return (
    <form
      className="glass-panel space-y-4 rounded-lg p-4 md:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {mode === "create" ? t("knowledge.createTitle") : t("knowledge.editTitle")}
        </h1>
        {mode === "create" ? (
          <p className="mt-1 max-w-3xl text-sm text-muted">{t("knowledge.createSubtitle")}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.titleLabel")}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={180}
            placeholder={t("knowledge.titlePlaceholder")}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.sectionLabel")}</span>
          <select
            id="knowledge-editor-section"
            value={section}
            onChange={(event) => setSection(event.target.value as KnowledgeSectionId)}
            className={fieldClass}
          >
            {KNOWLEDGE_SECTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.zh} / {item.en}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.ownerLabel")}</span>
          <input
            value={ownerName}
            onChange={(event) => {
              setOwnerTouched(true);
              setOwnerName(event.target.value);
            }}
            required
            maxLength={80}
            className={fieldClass}
          />
        </label>
        {canApprove ? (
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.statusLabel")}</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as KnowledgeStatus)}
              className={fieldClass}
            >
              {KNOWLEDGE_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(
                    item === "template"
                      ? "knowledge.statusTemplate"
                      : item === "draft"
                        ? "knowledge.statusDraft"
                        : "knowledge.statusApproved",
                  )}
                </option>
              ))}
            </select>
            {status === "approved" ? (
              <p className="mt-2 text-xs text-warning">{t("knowledge.approveTemplateWarning")}</p>
            ) : null}
          </label>
        ) : null}
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.bodyLabel")}</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={16}
            placeholder={t("knowledge.bodyPlaceholder")}
            className={`${fieldClass} min-h-64 resize-y leading-6`}
          />
        </label>
        <div className="md:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.linksTitle")}</span>
          <p className="mb-2 text-[12px] leading-5 text-muted">{t("knowledge.linksSavedWithDocument")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="knowledge-source-link"
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              placeholder={t("knowledge.linkPlaceholder")}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={addLink}
              className="rounded-md border border-card-border px-3 py-2 text-sm text-foreground"
            >
              {t("knowledge.addLink")}
            </button>
          </div>
          {links.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {links.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-foreground">
                    {link.kind === "google_drive" ? "Google Drive" : "Obsidian"} · {link.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLinks((current) => current.filter((item) => item.id !== link.id))}
                    className="shrink-0 text-[12px] text-muted hover:text-foreground"
                  >
                    {t("knowledge.remove")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-muted">{t("knowledge.attachments")}</span>
          <p className="mb-2 text-[12px] leading-5 text-muted">{t("knowledge.attachmentsHint")}</p>
          <label className="inline-flex cursor-pointer rounded-md border border-card-border px-3 py-2 text-sm text-foreground">
            {t("knowledge.addFiles")}
            <input
              id="knowledge-attachment-input"
              type="file"
              multiple
              accept={KNOWLEDGE_FILE_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                queueFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {pendingFiles.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {pendingFiles.map((file) => (
                <li key={file.name} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate text-foreground">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((current) => current.filter((item) => item !== file))}
                    className="text-[12px] text-muted hover:text-foreground"
                  >
                    {t("knowledge.remove")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {attachments.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {attachments.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate text-foreground">{file.fileName}</span>
                  <button
                    type="button"
                    onClick={() => void removeAttachment(file.id)}
                    className="text-[12px] text-muted hover:text-foreground"
                  >
                    {t("knowledge.remove")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {savedId ? (
        <Link href={`/dashboard/knowledge/${savedId}` as Route} className="text-sm text-accent">
          {t("knowledge.openSaved")}
        </Link>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="btn-premium rounded-md px-4 py-2 text-sm disabled:opacity-50">
          {saving ? t("common.loading") : t("common.save")}
        </button>
        {mode === "edit" && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-card-border px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
        ) : (
          <Link
            href={"/dashboard/knowledge" as Route}
            className="rounded-md border border-card-border px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            {t("common.cancel")}
          </Link>
        )}
      </div>
    </form>
  );
}
