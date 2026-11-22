"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useLocale } from "@/components/providers/locale-provider";
import { formatDateLocalized } from "@/lib/i18n";
import { knowledgeSection, type KnowledgeSectionId } from "@/lib/knowledge-base/sections";

type Match = {
  id: string;
  title: string;
  section: KnowledgeSectionId;
  ownerName: string;
  updatedAt: string;
  excerpt: string;
  status: "approved";
};

/**
 * Read-only lookup for staff. It does not write a reply and does not send anything.
 */
export function ApprovedKnowledgeLookup({ query }: { query: string }) {
  const { t, locale } = useLocale();
  const trimmed = query.trim();
  const [matches, setMatches] = useState<Match[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error" | "hidden">("idle");

  useEffect(() => {
    if (trimmed.length < 2) {
      setMatches([]);
      setState("idle");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState("loading");
      fetch(`/api/knowledge-base/lookup?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (res) => {
          if (res.status === 401 || res.status === 403) {
            setState("hidden");
            setMatches([]);
            return;
          }
          const data = await res.json().catch(() => null);
          if (!res.ok || !data || data.sendsToClient !== false || data.approvedOnly !== true) {
            setState("error");
            return;
          }
          setMatches(Array.isArray(data.matches) ? data.matches : []);
          setState("ready");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setState("error");
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  if (trimmed.length < 2 || state === "idle" || state === "hidden") return null;

  return (
    <div className="rounded-md border border-card-border bg-background px-3 py-3">
      <p className="text-xs font-semibold text-foreground">{t("knowledge.lookupTitle")}</p>
      <p className="mt-1 text-[12px] leading-5 text-muted">{t("knowledge.lookupHint")}</p>
      {state === "loading" ? <p className="mt-2 text-xs text-muted">{t("knowledge.lookupSearching")}</p> : null}
      {state === "error" ? <p className="mt-2 text-xs text-danger">{t("knowledge.lookupFailed")}</p> : null}
      {state === "ready" && matches.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-foreground/80">{t("knowledge.lookupEmpty")}</p>
      ) : null}
      {state === "ready" && matches.length > 0 ? (
        <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
          {matches.map((match) => {
            const section = knowledgeSection(match.section);
            return (
              <li key={match.id} className="border-l-2 border-secondary pl-3">
                <p className="text-[13px] font-medium text-foreground">{match.title}</p>
                <p className="text-[11px] text-muted">
                  {section?.zh} / {section?.en}
                  <span className="mx-1.5">·</span>
                  {match.ownerName}
                  <span className="mx-1.5">·</span>
                  {formatDateLocalized(match.updatedAt, locale)}
                </p>
                {match.excerpt ? <p className="mt-1 text-[12px] leading-5 text-muted">{match.excerpt}</p> : null}
                <Link
                  href={`/dashboard/knowledge/${match.id}` as Route}
                  className="mt-1 inline-block text-[12px] text-accent hover:underline"
                >
                  {t("knowledge.lookupOpen")}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
