"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { KnowledgeEditor } from "@/components/knowledge/knowledge-editor";
import { KnowledgeMarkdown } from "@/components/knowledge/knowledge-markdown";
import { KnowledgeStatusBadge } from "@/components/knowledge/knowledge-status-badge";
import { canApproveKnowledge, canEditKnowledge } from "@/lib/knowledge-base/access";
import { formatDateLocalized } from "@/lib/i18n";
import { knowledgeSection } from "@/lib/knowledge-base/sections";
import type { KnowledgeArticle } from "@/lib/knowledge-base/types";

export function KnowledgeArticleScreen({ id }: { id: string }) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [canEdit, setCanEdit] = useState(user ? canEditKnowledge(user.role) : false);
  const [canApprove, setCanApprove] = useState(user ? canApproveKnowledge(user.role) : false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge-base/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setArticle(null);
        setError(t("knowledge.notFound"));
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("knowledge.loadFailed"));
        return;
      }
      setArticle(data.article as KnowledgeArticle);
      setCanEdit(Boolean(data.canEdit));
      setCanApprove(Boolean(data.canApprove));
      setError(null);
    } catch {
      setError(t("knowledge.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(typeof data.error === "string" ? data.error : t("knowledge.saveFailed"));
        setConfirmDelete(false);
        return;
      }
      router.push("/dashboard/knowledge" as Route);
    } catch {
      setNotice(t("knowledge.saveFailed"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !article) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }
  if (!article) {
    return (
      <div>
        <p className="text-sm text-danger">{error ?? t("knowledge.notFound")}</p>
        <Link href={"/dashboard/knowledge" as Route} className="mt-3 inline-block text-sm text-accent">
          {t("knowledge.back")}
        </Link>
      </div>
    );
  }

  if (editing) {
    return (
      <KnowledgeEditor
        mode="edit"
        article={article}
        onCancel={() => setEditing(false)}
        onSaved={(saved, demoted) => {
          setArticle(saved);
          setEditing(false);
          setNotice(demoted ? t("knowledge.demoted") : t("knowledge.saved"));
        }}
      />
    );
  }

  const section = knowledgeSection(article.section);
  const banner =
    article.status === "approved"
      ? t("knowledge.approvedBanner")
      : article.status === "draft"
        ? t("knowledge.draftBanner")
        : t("knowledge.templateBanner");
  const statusLabel =
    article.status === "approved"
      ? t("knowledge.statusApproved")
      : article.status === "draft"
        ? t("knowledge.statusDraft")
        : t("knowledge.statusTemplate");

  return (
    <article className="mx-auto max-w-3xl">
      <Link href={"/dashboard/knowledge" as Route} className="text-[13px] text-accent hover:underline">
        {t("knowledge.back")}
      </Link>
      <header className="mt-4 border-b border-card-border pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{article.title}</h1>
          <KnowledgeStatusBadge status={article.status} label={statusLabel} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              {t("knowledge.section")}
            </dt>
            <dd className="mt-1 text-sm text-foreground">{section?.zh}</dd>
            <dd className="text-[12px] text-muted">{section?.en}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              {t("knowledge.owner")}
            </dt>
            <dd className="mt-1 text-sm text-foreground">{article.ownerName}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              {t("knowledge.updated")}
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatDateLocalized(article.updatedAt, locale)}
            </dd>
            {article.updatedBy ? (
              <dd className="text-[12px] text-muted">
                {t("knowledge.updatedBy", { name: article.updatedBy })}
              </dd>
            ) : null}
          </div>
        </dl>
      </header>

      <div
        className={
          article.status === "approved"
            ? "mt-5 border-l-2 border-secondary bg-surface-2 px-4 py-3 text-[13px] leading-6 text-foreground"
            : "mt-5 border-l-2 border-accent bg-surface-2 px-4 py-3 text-[13px] leading-6 text-foreground"
        }
      >
        {banner}
      </div>
      {notice ? <p className="mt-3 text-sm text-foreground">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-6">
        <KnowledgeMarkdown source={article.body} />
      </div>

      {canEdit || canApprove ? (
        <div className="mt-8 flex flex-wrap gap-2 border-t border-card-border pt-4">
          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setEditing(true);
              }}
              className="btn-premium rounded-md px-4 py-2 text-sm"
            >
              {t("common.edit")}
            </button>
          ) : null}
          {canApprove ? (
            confirmDelete ? (
              <>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void remove()}
                  className="rounded-md border border-danger/40 px-4 py-2 text-sm text-danger disabled:opacity-50"
                >
                  {t("knowledge.deleteConfirm")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-card-border px-4 py-2 text-sm text-muted"
                >
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-md border border-card-border px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                {t("knowledge.delete")}
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
