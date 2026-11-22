"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { BookOpen, Plus, Search } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { KnowledgeStatusBadge } from "@/components/knowledge/knowledge-status-badge";
import { canEditKnowledge } from "@/lib/knowledge-base/access";
import { formatDateLocalized } from "@/lib/i18n";
import {
  KNOWLEDGE_SECTIONS,
  type KnowledgeSectionId,
  type KnowledgeStatus,
} from "@/lib/knowledge-base/sections";
import type { KnowledgeArticleSummary } from "@/lib/knowledge-base/types";
import { cn } from "@/lib/utils";

type LibraryResponse = {
  articles: KnowledgeArticleSummary[];
  sections: Array<{ id: KnowledgeSectionId; zh: string; en: string; count: number }>;
  stats: { total: number; template: number; draft: number; approved: number };
  canEdit: boolean;
};

const STATUS_FILTERS: Array<KnowledgeStatus | "all"> = ["all", "template", "draft", "approved"];

export function KnowledgeLibrary() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const [section, setSection] = useState<KnowledgeSectionId | "all">("all");
  const [status, setStatus] = useState<KnowledgeStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (section !== "all") params.set("section", section);
    if (status !== "all") params.set("status", status);
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());

    setLoading(true);
    fetch(`/api/knowledge-base?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(typeof body.error === "string" ? body.error : t("knowledge.loadFailed"));
        }
        setData(body as LibraryResponse);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : t("knowledge.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [section, status, debouncedQuery, t]);

  const canEdit = data?.canEdit ?? (user ? canEditKnowledge(user.role) : false);
  const sections = data?.sections ?? KNOWLEDGE_SECTIONS.map((item) => ({ ...item, count: 0 }));
  const articles = data?.articles ?? [];

  function statusLabel(value: KnowledgeStatus | "all") {
    if (value === "all") return t("knowledge.allStatuses");
    if (value === "template") return t("knowledge.statusTemplate");
    if (value === "draft") return t("knowledge.statusDraft");
    return t("knowledge.statusApproved");
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-card-border pb-5">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-accent">
            <BookOpen className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
              {t("knowledge.badge")}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[26px]">
            {t("knowledge.title")}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("knowledge.subtitle")}</p>
          {data ? (
            <p className="mt-2 text-[13px] text-foreground/80">
              {t("knowledge.countLine", {
                total: data.stats.total,
                approved: data.stats.approved,
              })}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Link
            href={"/dashboard/knowledge/new" as Route}
            className="btn-premium inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            {t("knowledge.newArticle")}
          </Link>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            <button
              type="button"
              aria-pressed={section === "all"}
              onClick={() => setSection("all")}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-left text-[13px] lg:w-full",
                section === "all"
                  ? "bg-brand-navy text-white"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <span className="block font-medium">{t("knowledge.allSections")}</span>
            </button>
            {sections.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left lg:w-full",
                    active
                      ? "bg-brand-navy text-white"
                      : "text-foreground hover:bg-surface-2",
                  )}
                >
                  <span>
                    <span className="block text-[13px] font-medium">{item.zh}</span>
                    <span className={cn("block text-[11px]", active ? "text-white/70" : "text-muted")}>
                      {item.en}
                    </span>
                  </span>
                  <span className={cn("text-[12px] tabular-nums", active ? "text-white/80" : "text-muted")}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t("knowledge.searchLabel")}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  if (value.trim()) setSection("all");
                }}
                placeholder={t("knowledge.searchPlaceholder")}
                className="input-premium w-full rounded-md py-2 pl-9 pr-3 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-[12px]",
                    status === value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-card-border text-muted hover:text-foreground",
                  )}
                >
                  {statusLabel(value)}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
          {loading && !data ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}

          {!loading && articles.length === 0 ? (
            <div className="glass-panel rounded-lg px-4 py-8 text-sm text-muted">
              {debouncedQuery.trim() || status !== "all" ? (
                <>
                  <p>{t("knowledge.noMatches")}</p>
                  {section !== "all" && sections.some((item) => item.id !== section && item.count > 0) ? (
                    <p className="mt-2">{t("knowledge.matchesElsewhere")}</p>
                  ) : null}
                </>
              ) : (
                t("knowledge.emptySection")
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {articles.map((article) => {
                const sectionMeta = KNOWLEDGE_SECTIONS.find((item) => item.id === article.section);
                return (
                  <li key={article.id}>
                    <Link
                      href={`/dashboard/knowledge/${article.id}` as Route}
                      className={cn(
                        "block rounded-lg border border-card-border border-l-2 bg-surface px-4 py-3 transition-colors hover:border-border-strong",
                        article.status === "approved"
                          ? "border-l-secondary"
                          : article.status === "draft"
                            ? "border-l-warning"
                            : "border-l-accent",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-[15px] font-semibold text-foreground">{article.title}</h2>
                        <KnowledgeStatusBadge
                          status={article.status}
                          label={statusLabel(article.status)}
                        />
                      </div>
                      <p className="mt-1 text-[12px] text-muted">
                        <span>{sectionMeta?.zh}</span>
                        <span className="mx-1.5 text-border-strong">/</span>
                        <span>{sectionMeta?.en}</span>
                        <span className="mx-1.5">·</span>
                        <span>
                          {t("knowledge.owner")} {article.ownerName}
                        </span>
                        <span className="mx-1.5">·</span>
                        <span>
                          {t("knowledge.updated")} {formatDateLocalized(article.updatedAt, locale)}
                        </span>
                      </p>
                      {article.excerpt ? (
                        <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted">{article.excerpt}</p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
