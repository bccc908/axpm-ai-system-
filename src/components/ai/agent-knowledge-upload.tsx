"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, FileText, FileUp, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import {
  AGENT_KNOWLEDGE_ACCEPT,
  AGENT_KNOWLEDGE_MAX_BYTES,
  isAllowedKnowledgeFilename,
} from "@/lib/ai/agent-knowledge-shared";

type KnowledgeAnalysis = {
  summary: string;
  topics: string[];
  forCustomers: string[];
  mustNotSay: string[];
  fallback: boolean;
  analyzed_at: string;
};

type KnowledgeFileRow = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  charCount: number;
  uploaded_at: string;
  preview: string;
  analysis?: KnowledgeAnalysis | null;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AnalysisPanel({
  analysis,
  fallback,
  title,
  t,
}: {
  analysis: KnowledgeAnalysis;
  fallback: boolean;
  title: string;
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Brain className="h-4 w-4 text-accent" />
        <p className="text-sm font-medium text-foreground">{title}</p>
        {fallback && <Badge variant="muted">{t("ai.knowledgeOutlineBadge")}</Badge>}
        {!fallback && <Badge variant="default">{t("ai.knowledgeAnalyzed")}</Badge>}
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
        {analysis.summary}
      </p>
      {analysis.topics.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-1">{t("ai.knowledgeTopics")}</p>
          <div className="flex flex-wrap gap-1">
            {analysis.topics.map((topic) => (
              <Badge key={topic} variant="muted">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {analysis.forCustomers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-1">{t("ai.knowledgeForCustomers")}</p>
          <ul className="list-disc pl-4 text-xs text-foreground space-y-1">
            {analysis.forCustomers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {analysis.mustNotSay.length > 0 && (
        <div>
          <p className="text-xs font-medium text-danger/80 mb-1">{t("ai.knowledgeMustNot")}</p>
          <ul className="list-disc pl-4 text-xs text-muted space-y-1">
            {analysis.mustNotSay.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AgentKnowledgeUpload({
  onFilesChange,
}: {
  onFilesChange?: (count: number) => void;
}) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<KnowledgeFileRow[]>([]);
  const [combinedAnalysis, setCombinedAnalysis] = useState<KnowledgeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/agent-knowledge");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(t("ai.knowledgeLoadFailed"));
        setFiles([]);
        setCombinedAnalysis(null);
        onFilesChange?.(0);
        return;
      }
      const list = (data.files ?? []) as KnowledgeFileRow[];
      setFiles(list);
      setCombinedAnalysis(data.combinedAnalysis ?? null);
      onFilesChange?.(list.length);
      return list;
    } finally {
      setLoading(false);
    }
  }, [onFilesChange, t]);

  const runAnalyze = useCallback(
    async (fileId?: string) => {
      setAnalyzing(true);
      setStatus(t("ai.knowledgeAnalyzing"));
      try {
        const res = await fetch("/api/ai/agent-knowledge/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fileId ? { fileId } : {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(typeof data.error === "string" ? data.error : t("ai.knowledgeAnalyzeFailed"));
          return;
        }
        await load();
        setStatus(t("ai.knowledgeAnalyzeDone"));
      } catch {
        setStatus(t("ai.knowledgeAnalyzeFailed"));
      } finally {
        setAnalyzing(false);
      }
    },
    [load, t],
  );

  const autoAnalyzeDone = useRef(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || autoAnalyzeDone.current || files.length === 0) return;
    const needsAnalysis = !combinedAnalysis && files.every((f) => !f.analysis);
    if (needsAnalysis) {
      autoAnalyzeDone.current = true;
      void runAnalyze();
    }
  }, [loading, files, combinedAnalysis, runAnalyze]);

  async function uploadFileList(selected: File[]) {
    if (!selected.length) return;
    setUploading(true);
    setAnalyzing(true);
    setStatus(t("ai.knowledgeUploadAndAnalyze"));

    let ok = 0;
    let lastError: string | null = null;
    let lastCombined: KnowledgeAnalysis | null = null;

    for (const file of selected) {
      if (!isAllowedKnowledgeFilename(file.name)) {
        lastError = t("ai.knowledgeUnsupportedType");
        continue;
      }
      if (file.size > AGENT_KNOWLEDGE_MAX_BYTES) {
        lastError = t("ai.knowledgeTooLarge");
        continue;
      }

      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/ai/agent-knowledge/upload", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastError =
            typeof data.error === "string"
              ? data.error
              : res.status >= 500
                ? t("ai.knowledgeServerError")
                : t("ai.knowledgeUploadFailed");
          continue;
        }
        ok += 1;
        if (data.combinedAnalysis) lastCombined = data.combinedAnalysis;
      } catch {
        lastError = t("ai.knowledgeUploadFailed");
      }
    }

    if (ok > 0) {
      await load();
      if (lastCombined) setCombinedAnalysis(lastCombined);
      setStatus(t("ai.knowledgeUploadedAnalyzed", { n: ok }));
    } else if (lastError) {
      setStatus(lastError);
    }

    setUploading(false);
    setAnalyzing(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFiles(selected: FileList | null) {
    if (!selected?.length) return;
    void uploadFileList(Array.from(selected));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) void uploadFileList(dropped);
  }

  async function removeFile(id: string) {
    const res = await fetch(`/api/ai/agent-knowledge/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      setStatus(t("ai.knowledgeRemoved"));
      const remaining = files.filter((f) => f.id !== id);
      if (remaining.length > 0) await runAnalyze();
      else setCombinedAnalysis(null);
    }
  }

  const latestFile = files[0];

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-lg border border-dashed p-4 transition-colors ${
          dragOver
            ? "border-accent bg-accent/10"
            : "border-card-border bg-background/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={AGENT_KNOWLEDGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-8 w-8 shrink-0 text-accent/80" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("ai.uploadDocumentsTitle")}</p>
              <p className="mt-1 text-xs text-muted">{t("ai.uploadKnowledgeHint")}</p>
              <p className="mt-1 text-[10px] text-muted/80">{t("ai.uploadKnowledgeDrag")}</p>
              <p className="mt-1 text-[10px] text-accent/90">{t("ai.uploadNoLinkNeeded")}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={uploading || analyzing}
            onClick={() => inputRef.current?.click()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
          >
            {uploading || analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            {uploading
              ? t("ai.uploadingDocuments")
              : analyzing
                ? t("ai.knowledgeAnalyzing")
                : t("ai.uploadKnowledge")}
          </button>
        </div>
      </div>

      {status && <p className="text-xs text-muted">{status}</p>}

      {(analyzing || uploading) && (
        <p className="text-xs text-accent animate-pulse">{t("ai.knowledgeAnalyzingHint")}</p>
      )}

      {combinedAnalysis && files.length > 0 && (
        <AnalysisPanel
          analysis={combinedAnalysis}
          fallback={combinedAnalysis.fallback}
          title={t("ai.knowledgeWhatAiKnows")}
          t={t}
        />
      )}

      {latestFile?.analysis && files.length > 0 && (
        <AnalysisPanel
          analysis={latestFile.analysis}
          fallback={latestFile.analysis.fallback}
          title={t("ai.knowledgeFileAnalysis", { name: latestFile.name })}
          t={t}
        />
      )}

      {files.length > 0 && (
        <button
          type="button"
          disabled={analyzing || uploading}
          onClick={() => runAnalyze()}
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${analyzing ? "animate-spin" : ""}`} />
          {t("ai.knowledgeReanalyze")}
        </button>
      )}

      {loading ? (
        <p className="text-xs text-muted">{t("ai.knowledgeLoading")}</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted">{t("ai.noKnowledgeFiles")}</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-card-border bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{f.name}</p>
                <p className="text-[10px] text-muted">
                  {formatSize(f.size)} · {f.charCount.toLocaleString()} {t("ai.chars")} ·{" "}
                  {new Date(f.uploaded_at).toLocaleDateString()}
                  {f.analysis && (
                    <span className="text-accent">
                      {" "}
                      · {f.analysis.fallback ? t("ai.knowledgeOutline") : t("ai.knowledgeAnalyzed")}
                    </span>
                  )}
                </p>
                {f.preview && !f.analysis && (
                  <p className="mt-1 line-clamp-2 text-[10px] text-muted/80">{f.preview}…</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeFile(f.id)}
                className="shrink-0 rounded p-1 text-muted hover:text-danger"
                aria-label={t("ai.removeKnowledge")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
