"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { canApproveKnowledge, canEditKnowledge } from "@/lib/knowledge-base/access";
import { KNOWLEDGE_SECTIONS, KNOWLEDGE_STATUSES, type KnowledgeSectionId, type KnowledgeStatus } from "@/lib/knowledge-base/sections";
import type { KnowledgeArticle } from "@/lib/knowledge-base/types";

const fieldClass = "input-premium w-full rounded-md px-3 py-2 text-sm";

export function KnowledgeEditor({
  mode,
  article,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  article?: KnowledgeArticle;
  onCancel?: () => void;
  onSaved?: (article: KnowledgeArticle, demoted: boolean) => void;
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
    const payload: Record<string, string> = {
      title: title.trim(),
      section,
      body: body.trim(),
      ownerName: ownerName.trim() || user?.name || "",
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
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

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
