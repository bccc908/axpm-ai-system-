"use client";

import { linkIsOpenable } from "@/lib/knowledge-base/links";
import type {
  KnowledgeAttachment,
  KnowledgeSource,
  KnowledgeSourceLink,
} from "@/lib/knowledge-base/types";
import { cn } from "@/lib/utils";

function sourceClass(kind: string) {
  if (kind === "google_drive") return "border-accent/40 bg-accent/10 text-accent";
  if (kind === "obsidian") return "border-secondary/40 bg-secondary/10 text-secondary";
  return "border-card-border bg-surface-2 text-muted";
}

export function KnowledgeSourceLine({
  source,
  links,
  attachments,
  articleId,
  plain = false,
  sourceLabel,
  manualLabel,
  downloadLabel,
}: {
  source: KnowledgeSource;
  links: Array<Pick<KnowledgeSourceLink, "kind" | "label" | "url">>;
  attachments: Array<Pick<KnowledgeAttachment, "id" | "fileName" | "size" | "source">>;
  articleId?: string;
  plain?: boolean;
  sourceLabel: string;
  manualLabel: string;
  downloadLabel: string;
}) {
  const showSource = source !== "manual" || links.length > 0 || attachments.length > 0;
  if (!showSource) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{sourceLabel}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className={cn("rounded-md border px-2 py-0.5 text-[11px]", sourceClass(source))}>
          {source === "manual" ? manualLabel : source === "google_drive" ? "Google Drive" : "Obsidian"}
        </span>
        {attachments.length > 0 ? (
          <span className="rounded-md border border-card-border bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
            {attachments.length}
          </span>
        ) : null}
      </div>
      {links.length > 0 ? (
        <ul className="space-y-1">
          {links.map((link) => {
            const label = `${link.kind === "google_drive" ? "Google Drive" : "Obsidian"} · ${link.label}`;
            return (
              <li key={`${link.kind}:${link.url}`} className="truncate text-[13px]">
                {linkIsOpenable(link.url) && !plain ? (
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {label}
                  </a>
                ) : (
                  <span className="text-foreground">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {attachments.length > 0 ? (
        <ul className="space-y-1">
          {attachments.map((file) => (
            <li key={file.id} className="text-[13px]">
              {articleId && !plain ? (
                <a
                  href={`/api/knowledge-base/${articleId}/attachments/${file.id}`}
                  className="text-accent hover:underline"
                >
                  {file.fileName}
                </a>
              ) : (
                <span className="text-foreground">{file.fileName}</span>
              )}
              {downloadLabel ? <span className="ml-2 text-[12px] text-muted">{downloadLabel}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
