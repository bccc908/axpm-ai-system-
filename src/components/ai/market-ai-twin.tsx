"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Brain,
  ChevronDown,
  ChevronRight,
  Download,
  FileUp,
  ImageIcon,
  Loader2,
  Megaphone,
  PenLine,
  Presentation,
  RefreshCw,
  Send,
  Share2,
  Search,
  Trash2,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { ComparisonLadder } from "@/components/ai/comparison-ladder";
import type { ComparisonPlan } from "@/lib/ai/market-comparison-types";
import { SAMPLE_COMPARISON } from "@/lib/ai/market-comparison-types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateLocalized } from "@/lib/i18n";
import {
  isAllowedMarketFilename,
  MARKET_UPLOAD_ACCEPT,
} from "@/lib/ai/market-knowledge-shared";
import { AGENT_KNOWLEDGE_MAX_BYTES } from "@/lib/ai/agent-knowledge-shared";

type AdvisorMode = "market" | "data" | "copy";
type UploadCategory = "market" | "data";

type FileAnalysis = {
  summary: string;
  topics: string[];
  forCustomers?: string[];
  mustNotSay?: string[];
  fallback?: boolean;
};

type KnowledgeFileRow = {
  id: string;
  name: string;
  size: number;
  category: UploadCategory;
  uploaded_at: string;
  preview: string;
  stored?: boolean;
  downloadUrl?: string | null;
  analysis?: FileAnalysis | null;
};

type OutputRow = {
  id: string;
  kind: "ppt" | "image";
  title: string;
  files: { name: string; url: string }[];
  created_at: string;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  fallback?: boolean;
  downloadUrl?: string;
  downloadLabel?: string;
  searchSources?: { title: string; url: string }[];
  searchMode?: string;
  searchReason?: string;
};

type DiaryEntry = {
  id: string;
  question: string;
  answer: string;
  mode: string;
  fallback?: boolean;
  created_at: string;
};

type DiaryDayGroup = { date: string; items: DiaryEntry[] };

const inputClass =
  "w-full rounded-xl border border-card-border bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

function parseMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim());
}

/** Lightweight formatting for AI text — headers, bullets, markdown tables */
function FormattedText({ content, className }: { content: string; className?: string }) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseMarkdownTableRow(trimmed);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        bodyRows.push(parseMarkdownTableRow(lines[i]));
        i += 1;
      }
      nodes.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-lg border border-card-border">
          <table className="min-w-full text-sm">
            <thead className="bg-accent/10">
              <tr>
                {header.map((cell, ci) => (
                  <th
                    key={ci}
                    className="border-b border-card-border px-3 py-2 text-left font-semibold text-foreground"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-background/40" : ""}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-b border-card-border/60 px-3 py-2 text-foreground"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (!trimmed) {
      nodes.push(<div key={key++} className="h-2" />);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      nodes.push(
        <h3 key={key++} className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0">
          {trimmed.slice(3)}
        </h3>,
      );
      i += 1;
      continue;
    }

    const bullet = trimmed.match(/^[-•*]\s+(.+)/);
    const numbered = trimmed.match(/^\d+[\.\)]\s+(.+)/);
    const body = bullet?.[1] ?? numbered?.[1] ?? trimmed;

    const parts = body.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    if (bullet) {
      nodes.push(
        <div key={key++} className="flex gap-2.5 pl-1">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <p className="flex-1 leading-7">{parts}</p>
        </div>,
      );
    } else if (numbered) {
      const num = trimmed.match(/^(\d+)/)?.[1] ?? "•";
      nodes.push(
        <div key={key++} className="flex gap-2.5">
          <span className="w-5 shrink-0 text-right font-medium text-accent">{num}.</span>
          <p className="flex-1 leading-7">{parts}</p>
        </div>,
      );
    } else {
      nodes.push(
        <p key={key++} className="leading-7">
          {parts}
        </p>,
      );
    }
    i += 1;
  }

  return <div className={className}>{nodes}</div>;
}

function AnalysisPanel({
  analysis,
  title,
  subtitle,
  t,
}: {
  analysis: FileAnalysis & { fileName: string };
  title: string;
  subtitle?: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent/8 to-transparent p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Brain className="h-5 w-5 text-accent" />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {analysis.fallback ? (
          <Badge variant="warning">{t("marketAi.offlineBadge")}</Badge>
        ) : (
          <Badge variant="success">{t("marketAi.analyzedBadge")}</Badge>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-muted border-b border-card-border pb-3">{subtitle}</p>
      )}
      {analysis.topics && analysis.topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {analysis.topics.map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-card-border"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
      <FormattedText
        content={analysis.summary.replace(/^📄\s*[^\n]+\n*/m, "").trim()}
        className="text-[15px] text-foreground/95"
      />
      {analysis.forCustomers && analysis.forCustomers.length > 0 && (
        <div className="rounded-lg bg-background/60 p-4 ring-1 ring-card-border">
          <p className="mb-2 text-sm font-semibold text-foreground">{t("marketAi.keyPoints")}</p>
          <ul className="space-y-2">
            {analysis.forCustomers.map((item, idx) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                <span className="font-medium text-accent">{idx + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {analysis.mustNotSay && analysis.mustNotSay.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">{t("marketAi.complianceLines")}</p>
          <ul className="space-y-1 text-sm text-muted">
            {analysis.mustNotSay.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickLatestAnalysis(
  rows: KnowledgeFileRow[],
): (FileAnalysis & { fileName: string; fileId: string }) | null {
  const withAnalysis = rows.filter((f) => f.analysis?.summary?.trim());
  if (!withAnalysis.length) return null;

  const sorted = [...withAnalysis].sort((a, b) => {
    const aScore = a.analysis?.fallback ? 0 : 1;
    const bScore = b.analysis?.fallback ? 0 : 1;
    if (aScore !== bScore) return bScore - aScore;
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
  });

  const best = sorted[0];
  if (!best.analysis) return null;
  return { fileId: best.id, fileName: best.name, ...normalizeAnalysis(best.analysis) };
}

function mapUploadError(message: string, t: (key: string) => string) {
  const lower = message.toLowerCase();
  if (lower.includes(".doc") && lower.includes("not supported")) {
    return t("marketAi.legacyDocHint");
  }
  if (lower.includes("unsupported file")) {
    return t("marketAi.unsupportedType");
  }
  if (lower.includes("too large")) {
    return t("marketAi.tooLarge");
  }
  return message;
}

function searchModeLabel(
  mode: string | undefined,
  t: (key: string) => string,
): string {
  if (mode === "web") return t("marketAi.searchModeWeb");
  if (mode === "hybrid") return t("marketAi.searchModeHybrid");
  if (mode === "off") return t("marketAi.searchModeOff");
  return t("marketAi.searchModeLocal");
}

function normalizeAnalysis(analysis: Partial<FileAnalysis> | null | undefined): FileAnalysis {
  return {
    summary: analysis?.summary?.trim() ?? "",
    topics: analysis?.topics ?? [],
    forCustomers: analysis?.forCustomers ?? [],
    mustNotSay: analysis?.mustNotSay ?? [],
    fallback: analysis?.fallback ?? true,
  };
}

function analysisFromFileRow(f: KnowledgeFileRow) {
  return {
    fileId: f.id,
    fileName: f.name,
    ...normalizeAnalysis(f.analysis),
  };
}

export function MarketAiTwin() {
  const { t, locale } = useLocale();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const comparisonPreviewRef = useRef<HTMLDivElement>(null);
  const analysisPanelRef = useRef<HTMLDivElement>(null);

  function scrollToComparisonPreview() {
    window.setTimeout(
      () => comparisonPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      80,
    );
  }

  function triggerFileDownload(url: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  const [mode, setMode] = useState<AdvisorMode>("market");
  const [uploadCategory, setUploadCategory] = useState<UploadCategory>("market");
  const [files, setFiles] = useState<KnowledgeFileRow[]>([]);
  const [fileCounts, setFileCounts] = useState({ total: 0, market: 0, data: 0 });
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [input, setInput] = useState("");
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const [generatingChartPpt, setGeneratingChartPpt] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingComparison, setGeneratingComparison] = useState(false);
  const [comparisonPreview, setComparisonPreview] = useState<ComparisonPlan | null>(null);
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [diaryGroups, setDiaryGroups] = useState<DiaryDayGroup[]>([]);
  const [diaryTotal, setDiaryTotal] = useState(0);
  const [loadingDiary, setLoadingDiary] = useState(true);
  const [expandedDiaryId, setExpandedDiaryId] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<
    (FileAnalysis & { fileName: string; fileId?: string }) | null
  >(null);
  const [uploadBanner, setUploadBanner] = useState<{
    kind: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [outputsOpen, setOutputsOpen] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<{
    kind: "ppt" | "chart-ppt" | "image" | "comparison";
    title: string;
    downloadUrl: string;
    csvUrl?: string;
    slideCount: number;
    chartCount?: number;
    gammaUrl?: string;
  } | null>(null);
  const [engines, setEngines] = useState<{
    unstructured: boolean;
    gamma: boolean;
    dalle: boolean;
    webSearch: boolean;
    webSearchProvider?: string | null;
  } | null>(null);
  const [searchPreference, setSearchPreference] = useState<"auto" | "local">("auto");
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<{
    previewId: string;
    title: string;
    images: { name: string; url: string }[];
    slideCount: number;
    slideEdits: Record<number, string>;
    regeneratingSlide: number | null;
    saving: boolean;
  } | null>(null);

  const quickPrompts: Record<AdvisorMode, string[]> = {
    market: [
      t("marketAi.quickMarket1"),
      t("marketAi.quickMarket2"),
      t("marketAi.quickMarket3"),
    ],
    data: [t("marketAi.quickData1"), t("marketAi.quickData2"), t("marketAi.quickData3")],
    copy: [t("marketAi.quickCopy1"), t("marketAi.quickCopy2"), t("marketAi.quickCopy3")],
  };

  const loadFiles = useCallback(async (preferFileId?: string) => {
    setLoadingFiles(true);
    try {
      const res = await fetch("/api/ai/market-knowledge", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setFiles([]);
        return [];
      }
      const rows = (data.files ?? []) as KnowledgeFileRow[];
      setFiles(rows);
      setFileCounts(data.counts ?? { total: 0, market: 0, data: 0 });

      const preferred = preferFileId ? rows.find((f) => f.id === preferFileId) : null;
      if (preferred?.analysis?.summary?.trim()) {
        const picked = analysisFromFileRow(preferred);
        setLastAnalysis(picked);
        setExpandedFileId(preferred.id);
      } else {
        const latest = pickLatestAnalysis(rows);
        if (latest) {
          setLastAnalysis(latest);
          setExpandedFileId((prev) => prev ?? latest.fileId);
        }
      }
      return rows;
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const loadChatHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/market-advisor/history", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      const messages = (data.messages ?? []) as {
        role: "user" | "assistant";
        content: string;
        fallback?: boolean;
      }[];
      if (messages.length > 0) {
        setChat(
          messages.map((m) => ({
            role: m.role,
            content: m.content,
            fallback: m.fallback,
          })),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadOutputs = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/market-advisor/outputs", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setOutputs(data.outputs ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadDiary = useCallback(async () => {
    setLoadingDiary(true);
    try {
      const res = await fetch("/api/ai/market-advisor/diary", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setDiaryGroups(data.grouped ?? []);
        setDiaryTotal(data.total ?? 0);
      }
    } finally {
      setLoadingDiary(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
    loadDiary();
    loadOutputs();
    void loadChatHistory();
    fetch("/api/ai/deepseek/status")
      .then((r) => r.json())
      .then((d) => setAiReady(Boolean(d.ready)))
      .catch(() => setAiReady(false));
    fetch("/api/ai/market-advisor/status")
      .then((r) => r.json())
      .then((d) => {
        setEngines({
          unstructured: Boolean(d.unstructured),
          gamma: Boolean(d.gamma),
          dalle: Boolean(d.dalle),
          webSearch: Boolean(d.webSearch),
          webSearchProvider: d.webSearchProvider ?? null,
        });
        if (d.webSearch) setSearchPreference("auto");
      })
      .catch(() => setEngines(null));
  }, [loadFiles, loadDiary, loadOutputs, loadChatHistory]);

  function diaryModeLabel(mode: string) {
    if (mode === "data") return t("marketAi.modeData");
    if (mode === "copy") return t("marketAi.modeCopy");
    if (mode === "ppt") return t("marketAi.generatePpt");
    if (mode === "image") return t("marketAi.generateImages");
    return t("marketAi.modeMarket");
  }

  function formatDiaryTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-MY", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, sending]);

  async function uploadFiles(selected: File[], categoryOverride?: UploadCategory) {
    if (!selected.length) return;
    const category = categoryOverride ?? uploadCategory;
    setUploading(true);
    setUploadBanner(null);
    setUploadStatus(t("marketAi.uploadAnalyzing"));

    let ok = 0;
    let lastError: string | null = null;
    let lastUploadedId: string | null = null;
    let lastUploadedName = "";
    let lastFileAnalysis: (FileAnalysis & { fileName: string; fileId?: string }) | null = null;

    setChat((prev) => [
      ...prev,
      {
        role: "user",
        content: t("marketAi.uploadingMsg", {
          names: selected.map((f) => f.name).join(", "),
        }),
      },
    ]);

    for (const file of selected) {
      if (!isAllowedMarketFilename(file.name)) {
        lastError = t("marketAi.unsupportedType");
        continue;
      }
      if (file.size > AGENT_KNOWLEDGE_MAX_BYTES) {
        lastError = t("marketAi.tooLarge");
        continue;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("category", category);

      try {
        const res = await fetch("/api/ai/market-knowledge/upload", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          lastError = mapUploadError(
            typeof data.error === "string" ? data.error : t("marketAi.uploadFailed"),
            t,
          );
          continue;
        }
        ok += 1;
        lastUploadedId = data.file?.id ?? null;
        lastUploadedName = data.file?.name ?? file.name;

        if (data.file?.analysis?.summary) {
          lastFileAnalysis = {
            fileId: data.file.id,
            fileName: data.file.name,
            ...normalizeAnalysis(data.file.analysis),
          };
        } else if (lastUploadedId) {
          try {
            const analyzeRes = await fetch("/api/ai/market-knowledge/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileId: lastUploadedId }),
            });
            const analyzeData = await analyzeRes.json();
            if (analyzeRes.ok && analyzeData.analysis?.summary) {
              lastFileAnalysis = {
                fileId: lastUploadedId,
                fileName: lastUploadedName,
                ...normalizeAnalysis(analyzeData.analysis),
              };
            }
          } catch {
            /* analyze retry failed */
          }
        }
      } catch {
        lastError = t("marketAi.uploadFailed");
      }
    }

    if (ok > 0) {
      await loadFiles(lastUploadedId ?? undefined);
      await loadDiary();

      if (lastFileAnalysis?.summary) {
        setLastAnalysis(lastFileAnalysis);
        if (lastFileAnalysis.fileId) setExpandedFileId(lastFileAnalysis.fileId);
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${t("marketAi.analysisReadyTitle")}\n\n${lastFileAnalysis.summary}`,
            fallback: lastFileAnalysis.fallback,
          },
        ]);
        setUploadStatus(t("marketAi.uploadedAnalyzed", { n: ok }));
        setUploadBanner({
          kind: "success",
          message: t("marketAi.uploadSuccess", { name: lastUploadedName }),
        });
      } else {
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            content: t("marketAi.uploadStoredOnly", { name: lastUploadedName }),
          },
        ]);
        setUploadStatus(t("marketAi.uploaded", { n: ok }));
        setUploadBanner({
          kind: "info",
          message: t("marketAi.uploadStoredOnly", { name: lastUploadedName }),
        });
      }

      window.setTimeout(() => {
        analysisPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } else if (lastError) {
      setUploadStatus(lastError);
      setUploadBanner({ kind: "error", message: lastError });
      setChat((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${lastError}`, fallback: true },
      ]);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
  }

  async function importPastedText() {
    const title = pasteTitle.trim() || t("marketAi.pasteDefaultTitle");
    const text = pasteText.trim();
    if (text.length < 20) {
      setUploadBanner({ kind: "error", message: t("marketAi.pasteTooShort") });
      return;
    }

    setPasteSaving(true);
    setUploadBanner(null);
    try {
      const res = await fetch("/api/ai/market-knowledge/import-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          text,
          category: uploadCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadBanner({
          kind: "error",
          message: typeof data.error === "string" ? data.error : t("marketAi.pasteFailed"),
        });
        return;
      }

      setPasteText("");
      setPasteOpen(false);
      await loadFiles(data.file?.id);
      await loadDiary();

      if (data.file?.analysis?.summary) {
        setLastAnalysis({
          fileId: data.file.id,
          fileName: data.file.name,
          ...normalizeAnalysis(data.file.analysis),
        });
        setExpandedFileId(data.file.id);
        setUploadBanner({
          kind: "success",
          message: t("marketAi.pasteSuccess", { name: data.file.name }),
        });
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            content: t("marketAi.pasteDoneMsg", { name: title }),
          },
        ]);
      }
    } catch {
      setUploadBanner({ kind: "error", message: t("marketAi.pasteFailed") });
    } finally {
      setPasteSaving(false);
    }
  }

  function uploadCategoryForMode(): UploadCategory {
    return mode === "data" ? "data" : "market";
  }

  async function reanalyzeFile(fileId: string, fileName: string) {
    setAnalyzingFileId(fileId);
    setUploadStatus(t("marketAi.analyzing"));
    try {
      const res = await fetch("/api/ai/market-knowledge/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadStatus(typeof data.error === "string" ? data.error : t("marketAi.analyzeFailed"));
        return;
      }
      const analysis = data.analysis as FileAnalysis;
      setLastAnalysis({ fileName, ...analysis });
      setExpandedFileId(fileId);
      await loadFiles();
      await loadDiary();
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${t("marketAi.analysisReadyTitle")}\n\n${analysis.summary}`,
          fallback: analysis.fallback,
        },
      ]);
      setUploadStatus(t("marketAi.analyzeDone"));
    } catch {
      setUploadStatus(t("marketAi.analyzeFailed"));
    } finally {
      setAnalyzingFileId(null);
    }
  }

  async function removeFile(id: string) {
    const res = await fetch(`/api/ai/market-knowledge/${id}`, { method: "DELETE" });
    if (res.ok) await loadFiles();
  }

  function chatContext() {
    return chat
      .filter(
        (turn) =>
          !turn.content.startsWith("📎") &&
          !turn.content.startsWith("⚠️") &&
          !turn.content.includes(t("marketAi.analysisReadyTitle")),
      )
      .slice(-8)
      .map((turn) => `${turn.role === "user" ? "User" : "Kayden AI"}: ${turn.content}`)
      .join("\n");
  }

  function resolveTopic(fallback: string) {
    const fromInput = input.trim();
    if (fromInput) return fromInput.slice(0, 500);

    const skipUser = (text: string) =>
      text.startsWith("📎") ||
      text.startsWith("⚠️") ||
      text.includes("正在上传") ||
      text.toLowerCase().includes("uploading:");

    const lastUser = [...chat]
      .reverse()
      .find((turn) => turn.role === "user" && !skipUser(turn.content));
    if (lastUser?.content.trim()) {
      return lastUser.content.trim().slice(0, 500);
    }

    if (lastAnalysis?.fileName) {
      return lastAnalysis.fileName.replace(/\.[^.]+$/i, "").slice(0, 500) || fallback;
    }

    return fallback;
  }

  async function clearChatHistory() {
    setChat([]);
    setChatError(null);
    try {
      await fetch("/api/ai/market-advisor/history", { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }

  async function generatePpt() {
    const topic = resolveTopic(t("marketAi.defaultPptTopic"));
    setGeneratingPpt(true);
    setGenStatus(t("marketAi.pptGenerating"));
    setGeneratedAsset(null);
    try {
      const res = await fetch("/api/ai/market-advisor/generate-ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context: chatContext() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenStatus(typeof data.error === "string" ? data.error : t("marketAi.pptFailed"));
        return;
      }
      const slideCount = data.slideCount ?? 0;
      setGenStatus(t("marketAi.pptReady", { n: slideCount }));
      setGeneratedAsset({
        kind: "ppt",
        title: data.title ?? topic,
        downloadUrl: data.downloadUrl,
        slideCount,
        gammaUrl: typeof data.gammaUrl === "string" ? data.gammaUrl : undefined,
      });
      setOutputsOpen(true);
      await loadOutputs();
      await loadDiary();
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.provider === "gamma" && data.gammaUrl
              ? t("marketAi.pptGammaDoneMsg", { title: data.title ?? topic, n: slideCount })
              : t("marketAi.pptDoneMsg", { title: data.title ?? topic, n: slideCount }),
          downloadUrl: data.downloadUrl,
          downloadLabel: t("marketAi.downloadPptNow"),
        },
      ]);
      window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setGenStatus(t("marketAi.pptFailed"));
    } finally {
      setGeneratingPpt(false);
    }
  }

  async function generateChartPpt() {
    const topic = resolveTopic(t("marketAi.defaultChartTopic"));
    setGeneratingChartPpt(true);
    setGenStatus(t("marketAi.chartPptGenerating"));
    setGeneratedAsset(null);
    try {
      const res = await fetch("/api/ai/market-advisor/generate-chart-ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context: chatContext() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenStatus(typeof data.error === "string" ? data.error : t("marketAi.chartPptFailed"));
        return;
      }
      const chartCount = data.chartCount ?? 0;
      const slideCount = data.slideCount ?? 0;
      setGenStatus(t("marketAi.chartPptReady", { n: chartCount }));
      setGeneratedAsset({
        kind: "chart-ppt",
        title: data.title ?? topic,
        downloadUrl: data.downloadUrl,
        csvUrl: data.csvUrl,
        slideCount,
        chartCount,
      });
      setOutputsOpen(true);
      await loadOutputs();
      await loadDiary();
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("marketAi.chartPptDoneMsg", { title: data.title ?? topic, n: chartCount }),
          downloadUrl: data.downloadUrl,
          downloadLabel: t("marketAi.downloadChartPptNow"),
        },
      ]);
      window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setGenStatus(t("marketAi.chartPptFailed"));
    } finally {
      setGeneratingChartPpt(false);
    }
  }

  async function showComparisonSample() {
    setComparisonPreview(SAMPLE_COMPARISON);
    setGenStatus(t("marketAi.comparisonSampleLoaded"));
    setChat((prev) => [
      ...prev,
      {
        role: "assistant",
        content: t("marketAi.comparisonSampleHint"),
      },
    ]);
    scrollToComparisonPreview();
  }

  async function generateComparison() {
    const topic = resolveTopic(t("marketAi.defaultComparisonTopic"));
    setGeneratingComparison(true);
    setGenStatus(t("marketAi.comparisonGenerating"));
    setGeneratedAsset(null);
    try {
      const res = await fetch("/api/ai/market-advisor/generate-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context: chatContext() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenStatus(typeof data.error === "string" ? data.error : t("marketAi.comparisonFailed"));
        return;
      }
      if (data.plan) setComparisonPreview(data.plan as ComparisonPlan);
      setGenStatus(t("marketAi.comparisonReady"));
      setGeneratedAsset({
        kind: "comparison",
        title: data.title ?? topic,
        downloadUrl: data.downloadUrl,
        csvUrl: data.csvUrl,
        slideCount: 2,
        chartCount: data.columnCount,
      });
      setOutputsOpen(true);
      await loadOutputs();
      await loadDiary();
      scrollToComparisonPreview();
      if (typeof data.downloadUrl === "string") triggerFileDownload(data.downloadUrl);
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("marketAi.comparisonDoneMsg", {
            title: data.title ?? topic,
            n: data.columnCount ?? 0,
          }),
          downloadUrl: data.downloadUrl,
          downloadLabel: t("marketAi.downloadComparisonPpt"),
        },
      ]);
    } catch {
      setGenStatus(t("marketAi.comparisonFailed"));
    } finally {
      setGeneratingComparison(false);
    }
  }

  async function exportComparisonSamplePpt() {
    setGeneratingComparison(true);
    setGenStatus(t("marketAi.comparisonGenerating"));
    try {
      const res = await fetch("/api/ai/market-advisor/generate-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useSample: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenStatus(typeof data.error === "string" ? data.error : t("marketAi.comparisonFailed"));
        return;
      }
      setComparisonPreview(SAMPLE_COMPARISON);
      setGeneratedAsset({
        kind: "comparison",
        title: data.title ?? SAMPLE_COMPARISON.title,
        downloadUrl: data.downloadUrl,
        csvUrl: data.csvUrl,
        slideCount: 2,
        chartCount: data.columnCount,
      });
      setGenStatus(t("marketAi.comparisonReady"));
      setOutputsOpen(true);
      await loadOutputs();
      scrollToComparisonPreview();
      if (typeof data.downloadUrl === "string") triggerFileDownload(data.downloadUrl);
    } catch {
      setGenStatus(t("marketAi.comparisonFailed"));
    } finally {
      setGeneratingComparison(false);
    }
  }

  async function generateImages() {
    const topic = resolveTopic(t("marketAi.defaultPptTopic"));
    setGeneratingImages(true);
    setGenStatus(t("marketAi.imagesGenerating"));
    setGeneratedAsset(null);
    setImagePreview(null);
    try {
      const res = await fetch("/api/ai/market-advisor/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context: chatContext() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenStatus(typeof data.error === "string" ? data.error : t("marketAi.imagesFailed"));
        return;
      }
      const slideCount = data.slideCount ?? 0;
      setGenStatus(t("marketAi.imagePreviewTitle"));
      setImagePreview({
        previewId: data.previewId,
        title: data.title ?? topic,
        images: data.images ?? [],
        slideCount,
        slideEdits: {},
        regeneratingSlide: null,
        saving: false,
      });
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("marketAi.imagePreviewHint"),
        },
      ]);
      window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setGenStatus(t("marketAi.imagesFailed"));
    } finally {
      setGeneratingImages(false);
    }
  }

  async function regeneratePreviewSlide(slideIndex: number) {
    if (!imagePreview || imagePreview.regeneratingSlide !== null) return;
    setImagePreview((prev) =>
      prev ? { ...prev, regeneratingSlide: slideIndex } : prev,
    );
    try {
      const res = await fetch("/api/ai/market-advisor/generate-images/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: imagePreview.previewId,
          slideIndex,
          editNote: imagePreview.slideEdits[slideIndex]?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenStatus(typeof data.error === "string" ? data.error : t("marketAi.imagesFailed"));
        return;
      }
      setImagePreview((prev) => {
        if (!prev) return prev;
        const images = [...prev.images];
        images[slideIndex] = data.image;
        return { ...prev, images, regeneratingSlide: null };
      });
    } catch {
      setGenStatus(t("marketAi.imagesFailed"));
      setImagePreview((prev) => (prev ? { ...prev, regeneratingSlide: null } : prev));
    }
  }

  async function saveImagePreview() {
    if (!imagePreview || imagePreview.saving) return;
    setImagePreview((prev) => (prev ? { ...prev, saving: true } : prev));
    try {
      const res = await fetch("/api/ai/market-advisor/generate-images/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId: imagePreview.previewId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenStatus(typeof data.error === "string" ? data.error : t("marketAi.imagesFailed"));
        setImagePreview((prev) => (prev ? { ...prev, saving: false } : prev));
        return;
      }
      const firstImage = data.images?.[0]?.url as string | undefined;
      setGenStatus(t("marketAi.imagePreviewSaved"));
      setImagePreview(null);
      if (firstImage) {
        setGeneratedAsset({
          kind: "image",
          title: data.title ?? imagePreview.title,
          downloadUrl: firstImage,
          slideCount: data.slideCount ?? imagePreview.slideCount,
        });
      }
      setOutputsOpen(true);
      await loadOutputs();
      await loadDiary();
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("marketAi.imagesDoneMsg", {
            title: data.title ?? imagePreview.title,
            n: data.slideCount ?? imagePreview.slideCount,
          }),
          downloadUrl: firstImage,
          downloadLabel: t("marketAi.downloadImagesNow"),
        },
      ]);
    } catch {
      setGenStatus(t("marketAi.imagesFailed"));
      setImagePreview((prev) => (prev ? { ...prev, saving: false } : prev));
    }
  }

  async function discardImagePreview() {
    if (!imagePreview) return;
    const previewId = imagePreview.previewId;
    setImagePreview(null);
    setGenStatus(t("marketAi.imagePreviewDiscarded"));
    try {
      await fetch("/api/ai/market-advisor/generate-images/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId }),
      });
    } catch {
      /* ignore */
    }
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    setInput("");
    setChatError(null);
    setSending(true);

    const history = chat.slice(-10);
    setChat((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/ai/market-advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          message: text,
          history: history.map(({ role, content }) => ({ role, content })),
          useSearch: searchPreference === "local" ? false : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : t("marketAi.chatFailed");
        setChatError(errMsg);
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: errMsg, fallback: true },
        ]);
        return;
      }
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.content ?? t("marketAi.chatFailed"),
          fallback: Boolean(data.fallback),
          searchSources: Array.isArray(data.searchSources) ? data.searchSources : undefined,
          searchMode: typeof data.searchMode === "string" ? data.searchMode : undefined,
          searchReason:
            locale === "zh"
              ? (typeof data.searchReasonZh === "string" ? data.searchReasonZh : undefined)
              : (typeof data.searchReasonEn === "string" ? data.searchReasonEn : undefined),
        },
      ]);
      if (data.notice) setChatError(data.notice);
      await loadDiary();
    } catch {
      const errMsg = t("marketAi.chatFailed");
      setChatError(errMsg);
      setChat((prev) => [...prev, { role: "assistant", content: errMsg, fallback: true }]);
    } finally {
      setSending(false);
    }
  }

  const modeButtons: { id: AdvisorMode; label: string; icon: typeof Megaphone }[] = [
    { id: "market", label: t("marketAi.modeMarket"), icon: Megaphone },
    { id: "data", label: t("marketAi.modeData"), icon: BarChart3 },
    { id: "copy", label: t("marketAi.modeCopy"), icon: PenLine },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("marketAi.title")}</h1>
        <p className="mt-2 text-base text-muted leading-relaxed">{t("marketAi.subtitle")}</p>
        {engines && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">{t("marketAi.enginesTitle")}:</span>
            <Badge variant={engines.unstructured ? "success" : "muted"}>
              {t("marketAi.engineUnstructured")} ·{" "}
              {engines.unstructured ? t("marketAi.engineOn") : t("marketAi.engineOff")}
            </Badge>
            <Badge variant={engines.gamma ? "success" : "muted"}>
              {t("marketAi.engineGamma")} ·{" "}
              {engines.gamma ? t("marketAi.engineOn") : t("marketAi.engineOff")}
            </Badge>
            <Badge variant={engines.dalle ? "success" : "muted"}>
              {t("marketAi.engineDalle")} ·{" "}
              {engines.dalle ? t("marketAi.engineOn") : t("marketAi.engineOff")}
            </Badge>
            <Badge variant={engines.webSearch ? "success" : "muted"}>
              {engines.webSearchProvider === "serper"
                ? t("marketAi.engineSerper")
                : engines.webSearchProvider === "tavily"
                  ? t("marketAi.engineTavily")
                  : t("marketAi.engineWebSearch")}{" "}
              · {engines.webSearch ? t("marketAi.engineOn") : t("marketAi.engineOff")}
            </Badge>
          </div>
        )}
      </div>

      {lastAnalysis && (
        <div ref={analysisPanelRef}>
          <AnalysisPanel
            analysis={lastAnalysis}
            title={t("marketAi.latestAnalysis")}
            subtitle={t("marketAi.analysisFromFile", { name: lastAnalysis.fileName })}
            t={t}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,380px)_1fr]">
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-card-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">{t("marketAi.filesTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("marketAi.filesDesc")}</p>
            </div>
            <div className="space-y-4 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["market", t("marketAi.catMarket")],
                  ["data", t("marketAi.catData")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setUploadCategory(id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    uploadCategory === id
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-card-border text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void uploadFiles(Array.from(e.dataTransfer.files));
              }}
              className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                dragOver ? "border-accent bg-accent/10" : "border-card-border"
              }`}
            >
              <FileUp className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-2 text-sm font-medium text-foreground">{t("marketAi.dropHint")}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{t("marketAi.formatsHint")}</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={MARKET_UPLOAD_ACCEPT}
                className="hidden"
                onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {t("marketAi.chooseFiles")}
              </button>
            </div>

            <div className="rounded-xl border border-card-border bg-background/50 p-4 space-y-3">
              <button
                type="button"
                onClick={() => setPasteOpen((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-medium text-foreground"
              >
                <span>{t("marketAi.pasteTitle")}</span>
                {pasteOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted" />
                )}
              </button>
              <p className="text-xs leading-relaxed text-muted">{t("marketAi.pasteDesc")}</p>
              {pasteOpen && (
                <div className="space-y-3">
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={t("marketAi.pasteNamePlaceholder")}
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                  />
                  <textarea
                    rows={6}
                    className={inputClass}
                    placeholder={t("marketAi.pastePlaceholder")}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={pasteSaving || pasteText.trim().length < 20}
                    onClick={() => void importPastedText()}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
                  >
                    {pasteSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PenLine className="h-4 w-4" />
                    )}
                    {t("marketAi.pasteSave")}
                  </button>
                </div>
              )}
            </div>

            {uploadStatus && (
              <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted">{uploadStatus}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="muted">
                {t("marketAi.fileCountMarket", { n: fileCounts.market })}
              </Badge>
              <Badge variant="muted">{t("marketAi.fileCountData", { n: fileCounts.data })}</Badge>
            </div>

            {loadingFiles ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted">{t("marketAi.noFiles")}</p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className={`rounded-xl border p-3.5 text-sm transition-colors ${
                      expandedFileId === f.id
                        ? "border-accent/40 bg-accent/5"
                        : "border-card-border bg-background/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug text-foreground">{f.name}</p>
                        <p className="mt-1 text-xs text-muted">
                          {formatSize(f.size)} ·{" "}
                          {f.category === "data"
                            ? t("marketAi.catData")
                            : t("marketAi.catMarket")}
                        </p>
                        {f.analysis && (
                          <div className="mt-2">
                            {f.analysis.fallback ? (
                              <Badge variant="warning">{t("marketAi.offlineBadge")}</Badge>
                            ) : (
                              <Badge variant="success">{t("marketAi.analyzedBadge")}</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeFile(f.id)}
                        className="shrink-0 rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {f.analysis?.summary && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                          onClick={() => {
                            setExpandedFileId(expandedFileId === f.id ? null : f.id);
                            if (f.analysis) {
                              setLastAnalysis({ fileName: f.name, ...f.analysis });
                            }
                          }}
                        >
                          {expandedFileId === f.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {t("marketAi.viewAnalysis")}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={analyzingFileId === f.id || uploading}
                        onClick={() => void reanalyzeFile(f.id, f.name)}
                        className="inline-flex items-center gap-1 text-sm text-accent hover:underline disabled:opacity-50"
                      >
                        {analyzingFileId === f.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Brain className="h-4 w-4" />
                        )}
                        {t("marketAi.reanalyze")}
                      </button>
                      {f.downloadUrl && (
                        <a
                          href={f.downloadUrl}
                          className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent"
                        >
                          <Download className="h-4 w-4" />
                          {t("marketAi.downloadStored")}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </Card>

          <details className="group rounded-xl border border-card-border bg-card">
            <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{t("marketAi.diaryTitle")}</h2>
                  <p className="mt-0.5 text-sm text-muted">{t("marketAi.diaryDesc")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {diaryTotal > 0 && (
                    <Badge variant="muted">{t("marketAi.diaryCount", { n: diaryTotal })}</Badge>
                  )}
                  <ChevronDown className="h-5 w-5 text-muted transition group-open:rotate-180" />
                </div>
              </div>
            </summary>
            <div className="border-t border-card-border px-5 pb-4">
            {loadingDiary ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : diaryGroups.length === 0 ? (
              <p className="py-2 text-sm text-muted">{t("marketAi.diaryEmpty")}</p>
            ) : (
              <ul className="max-h-80 space-y-4 overflow-y-auto pt-2">
                {diaryGroups.map((group) => (
                  <li key={group.date}>
                    <p className="mb-2 text-sm font-semibold text-accent">
                      {formatDateLocalized(group.date, locale)}
                    </p>
                    <ul className="space-y-2">
                      {group.items.map((entry) => {
                        const open = expandedDiaryId === entry.id;
                        return (
                          <li
                            key={entry.id}
                            className="rounded-xl border border-card-border bg-background/50 text-sm"
                          >
                            <button
                              type="button"
                              className="flex w-full items-start gap-2 p-3 text-left hover:bg-card-border/20"
                              onClick={() =>
                                setExpandedDiaryId(open ? null : entry.id)
                              }
                            >
                              {open ? (
                                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                              ) : (
                                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-muted">{formatDiaryTime(entry.created_at)}</span>
                                  <Badge variant="muted">{diaryModeLabel(entry.mode)}</Badge>
                                </div>
                                <p className="mt-1.5 line-clamp-2 font-medium leading-snug text-foreground">
                                  {entry.question}
                                </p>
                              </div>
                            </button>
                            {open && (
                              <div className="border-t border-card-border px-4 py-3 space-y-3">
                                <FormattedText
                                  content={entry.answer}
                                  className="text-sm text-foreground/90"
                                />
                                <button
                                  type="button"
                                  className="text-sm text-accent hover:underline"
                                  onClick={() => setInput(entry.question.replace(/^\[(生成 PPT|生成配图)\]\s*/, ""))}
                                >
                                  {t("marketAi.diaryAskAgain")}
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </details>

          <details
            className="group rounded-xl border border-card-border bg-card"
            open={outputsOpen}
            onToggle={(e) => setOutputsOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{t("marketAi.outputsTitle")}</h2>
                  <p className="mt-0.5 text-sm text-muted">{t("marketAi.outputsDesc")}</p>
                </div>
                <ChevronDown className="h-5 w-5 text-muted transition group-open:rotate-180" />
              </div>
            </summary>
            <div className="border-t border-card-border px-5 pb-4 pt-2">
            {outputs.length === 0 ? (
              <p className="py-2 text-sm text-muted">{t("marketAi.noOutputs")}</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {outputs.map((o) => (
                  <li key={o.id} className="rounded-xl border border-card-border p-3.5 text-sm">
                    <div className="flex items-center gap-2">
                      {o.kind === "ppt" ? (
                        <Presentation className="h-4 w-4 text-accent" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-accent" />
                      )}
                      <span className="font-medium text-foreground">{o.title}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {o.files.map((f) => (
                        <a
                          key={f.url}
                          href={f.url}
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          {f.name}
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </div>
          </details>

          <div className="rounded-xl border border-card-border bg-card px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">{t("marketAi.personaTitle")}</h2>
            <p className="mt-1 text-sm text-muted">{t("marketAi.personaDesc")}</p>
            <Link
              href="/dashboard/social-media"
              className="mt-3 inline-flex items-center gap-2 text-sm text-accent hover:underline"
            >
              <Share2 className="h-4 w-4" />
              {t("marketAi.editPersona")}
            </Link>
          </div>
        </div>

      <Card className="flex min-h-[640px] flex-col p-0 overflow-hidden">
        <div className="border-b border-card-border px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("marketAi.chatTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("marketAi.chatDesc")}</p>
            </div>
            {aiReady !== null && (
              <Badge variant={aiReady ? "success" : "warning"}>
                {aiReady ? "DeepSeek" : t("marketAi.aiOffline")}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-card-border bg-background/40 px-5 py-3">
          {modeButtons.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                mode === id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-card-border text-muted hover:border-accent/30 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-background/20 px-5 py-4">
          {chat.length === 0 && (
            <div className="rounded-xl border border-dashed border-card-border bg-card/50 p-5 space-y-4">
              <div className="flex items-start gap-3 text-[15px] leading-relaxed text-foreground">
                <Brain className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <p>
                  {fileCounts.total > 0
                    ? t("marketAi.filesReadyHint", { n: fileCounts.total })
                    : t("marketAi.emptyChat")}
                </p>
              </div>
              {lastAnalysis && !lastAnalysis.fallback && (
                <p className="text-sm text-muted">{t("marketAi.startChatHint")}</p>
              )}
              {lastAnalysis?.fallback && (
                <p className="text-sm text-warning">{t("marketAi.weakAnalysisHint")}</p>
              )}
              <div className="rounded-lg bg-accent/5 px-4 py-3 text-sm space-y-1.5">
                <p className="font-medium text-foreground">{t("marketAi.qualityTipsTitle")}</p>
                <ul className="list-disc pl-5 text-muted space-y-1">
                  <li>{t("marketAi.qualityTip1")}</li>
                  <li>{t("marketAi.qualityTip2")}</li>
                  <li>{t("marketAi.qualityTip3")}</li>
                  <li>{t("marketAi.qualityTip4")}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {t("marketAi.quickPrompts")}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {quickPrompts[mode].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendMessage(q)}
                      className="rounded-xl border border-card-border bg-background px-4 py-2.5 text-left text-sm leading-snug text-foreground hover:border-accent/40 hover:bg-accent/5"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {chat.map((turn, i) => (
            <div
              key={i}
              className={`flex flex-col gap-1.5 ${
                turn.role === "user" ? "items-end pl-8" : "items-start pr-8"
              }`}
            >
              <span className="px-1 text-xs font-medium text-muted">
                {turn.role === "user" ? t("marketAi.you") : t("marketAi.assistantLabel")}
              </span>
              <div
                className={`max-w-full rounded-2xl px-4 py-3 ${
                  turn.role === "user"
                    ? "bg-accent text-white"
                    : "border border-card-border bg-card text-foreground shadow-sm"
                }`}
              >
                {turn.role === "assistant" && turn.fallback && (
                  <Badge variant="warning" className="mb-2">
                    {t("marketAi.offlineBadge")}
                  </Badge>
                )}
                {turn.role === "assistant" && turn.searchMode && (
                  <Badge variant="muted" className="mb-2">
                    {searchModeLabel(turn.searchMode, t)}
                    {turn.searchReason ? ` · ${turn.searchReason}` : ""}
                  </Badge>
                )}
                {turn.role === "user" ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-7">{turn.content}</p>
                ) : (
                  <>
                    <FormattedText content={turn.content} className="text-[15px]" />
                    {turn.searchSources && turn.searchSources.length > 0 && (
                      <div className="mt-3 border-t border-card-border pt-3">
                        <p className="mb-2 text-xs font-medium text-muted">
                          {t("marketAi.searchSourcesLabel")}
                        </p>
                        <ul className="space-y-1">
                          {turn.searchSources.slice(0, 5).map((source) => (
                            <li key={source.url}>
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-accent hover:underline"
                              >
                                {source.title || source.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {turn.downloadUrl && (
                      <a
                        href={turn.downloadUrl}
                        download
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted"
                      >
                        <Download className="h-4 w-4" />
                        {turn.downloadLabel ?? t("marketAi.downloadPptNow")}
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 px-1 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {engines?.webSearch && searchPreference === "auto"
                ? t("marketAi.thinkingSearch")
                : t("marketAi.thinking")}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {chatError && (
          <p className="border-t border-card-border px-5 py-2 text-sm text-warning">{chatError}</p>
        )}

        <div className="border-t border-card-border bg-card/80 p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={chatFileInputRef}
              type="file"
              multiple
              accept={MARKET_UPLOAD_ACCEPT}
              className="hidden"
              onChange={(e) =>
                void uploadFiles(Array.from(e.target.files ?? []), uploadCategoryForMode())
              }
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => chatFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-card-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-accent/40 hover:bg-accent/5 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              ) : (
                <FileUp className="h-4 w-4 text-accent" />
              )}
              {t("marketAi.chatUpload")}
            </button>
            <span className="text-xs text-muted">
              {t("marketAi.chatUploadHint", {
                cat:
                  uploadCategoryForMode() === "data"
                    ? t("marketAi.catData")
                    : t("marketAi.catMarket"),
              })}
            </span>
            {uploadStatus && uploading && (
              <span className="text-sm font-medium text-accent">{uploadStatus}</span>
            )}
          </div>
          {uploadBanner && (
            <div
              className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                uploadBanner.kind === "success"
                  ? "border border-success/30 bg-success/10 text-foreground"
                  : uploadBanner.kind === "error"
                    ? "border border-danger/30 bg-danger/10 text-foreground"
                    : "border border-card-border bg-background text-foreground"
              }`}
            >
              {uploadBanner.message}
            </div>
          )}
          {comparisonPreview && (
            <div
              ref={comparisonPreviewRef}
              className="overflow-hidden rounded-2xl border border-slate-700/40 shadow-lg"
            >
              <ComparisonLadder plan={comparisonPreview} />
              <div className="flex flex-wrap gap-2 border-t border-slate-700/40 bg-slate-950/90 px-4 py-3">
                <button
                  type="button"
                  disabled={generatingComparison}
                  onClick={() => void exportComparisonSamplePpt()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  {generatingComparison ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {t("marketAi.exportSamplePpt")}
                </button>
              </div>
            </div>
          )}
          {imagePreview && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{t("marketAi.imagePreviewTitle")}</p>
                  <p className="mt-1 text-sm text-muted">《{imagePreview.title}》</p>
                  <p className="mt-1 text-xs text-muted">{t("marketAi.imagePreviewHint")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={imagePreview.saving}
                    onClick={() => void discardImagePreview()}
                    className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
                  >
                    {t("marketAi.imageDiscardPreview")}
                  </button>
                  <button
                    type="button"
                    disabled={imagePreview.saving || imagePreview.regeneratingSlide !== null}
                    onClick={() => void saveImagePreview()}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
                  >
                    {imagePreview.saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {t("marketAi.imageSaveAll")}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {imagePreview.images.map((img, index) => (
                  <div
                    key={img.name}
                    className="overflow-hidden rounded-xl border border-card-border bg-background"
                  >
                    <div className="relative aspect-video bg-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Slide ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                        {index + 1}/{imagePreview.slideCount}
                      </span>
                      {imagePreview.regeneratingSlide === index && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 p-3">
                      <input
                        type="text"
                        value={imagePreview.slideEdits[index] ?? ""}
                        onChange={(e) =>
                          setImagePreview((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  slideEdits: {
                                    ...prev.slideEdits,
                                    [index]: e.target.value,
                                  },
                                }
                              : prev,
                          )
                        }
                        placeholder={t("marketAi.imageEditPlaceholder")}
                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted"
                      />
                      <button
                        type="button"
                        disabled={
                          imagePreview.regeneratingSlide !== null || imagePreview.saving
                        }
                        onClick={() => void regeneratePreviewSlide(index)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent/30 px-3 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {imagePreview.regeneratingSlide === index
                          ? t("marketAi.imageRegenerating")
                          : t("marketAi.imageRegenerateSlide")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {generatedAsset && (
            <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-foreground">
                <p className="font-medium">
                  {generatedAsset.kind === "chart-ppt"
                    ? t("marketAi.chartPptReady", { n: generatedAsset.chartCount ?? 0 })
                    : generatedAsset.kind === "comparison"
                      ? t("marketAi.comparisonReady")
                      : generatedAsset.kind === "ppt"
                      ? t("marketAi.pptReady", { n: generatedAsset.slideCount })
                      : t("marketAi.imagesReady", { n: generatedAsset.slideCount })}
                </p>
                <p className="mt-1 text-muted">《{generatedAsset.title}》</p>
              </div>
              <a
                href={generatedAsset.downloadUrl}
                download
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted"
              >
                <Download className="h-4 w-4" />
                {generatedAsset.kind === "chart-ppt"
                  ? t("marketAi.downloadChartPptNow")
                  : generatedAsset.kind === "comparison"
                    ? t("marketAi.downloadComparisonPpt")
                    : generatedAsset.kind === "ppt"
                    ? t("marketAi.downloadPptNow")
                    : t("marketAi.downloadImagesNow")}
              </a>
              {generatedAsset.csvUrl && (
                <a
                  href={generatedAsset.csvUrl}
                  download
                  className="inline-flex items-center gap-2 rounded-lg border border-card-border px-4 py-2 text-sm font-medium text-foreground hover:border-accent/40"
                >
                  <Download className="h-4 w-4" />
                  {t("marketAi.downloadChartCsv")}
                </a>
              )}
              {generatedAsset.gammaUrl && (
                <a
                  href={generatedAsset.gammaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-accent/40 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/5"
                >
                  <Presentation className="h-4 w-4" />
                  {t("marketAi.openGamma")}
                </a>
              )}
            </div>
          )}
          <textarea
            ref={inputRef}
            rows={3}
            className={inputClass}
            placeholder={t("marketAi.inputPlaceholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void clearChatHistory()}
                className="text-sm text-muted hover:text-foreground"
              >
                {t("marketAi.clearChat")}
              </button>
              <span className="hidden text-xs text-muted sm:inline">{t("marketAi.clearChatHint")}</span>
              {engines?.webSearch && (
                <div className="inline-flex rounded-lg border border-card-border p-0.5 text-sm">
                  <button
                    type="button"
                    onClick={() => setSearchPreference("auto")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                      searchPreference === "auto"
                        ? "bg-accent/15 text-accent"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Search className="h-4 w-4" />
                    {t("marketAi.searchAuto")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchPreference("local")}
                    className={`rounded-md px-3 py-1.5 ${
                      searchPreference === "local"
                        ? "bg-accent/15 text-accent"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {t("marketAi.searchLocalOnly")}
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={
                  generatingPpt ||
                  generatingChartPpt ||
                  generatingImages ||
                  generatingComparison
                }
                onClick={() => void showComparisonSample()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/15 disabled:opacity-50"
              >
                {t("marketAi.loadComparisonSample")}
              </button>
              <button
                type="button"
                disabled={
                  generatingPpt ||
                  generatingChartPpt ||
                  generatingImages ||
                  generatingComparison
                }
                onClick={() => void generateComparison()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm text-accent hover:border-accent/50 disabled:opacity-50"
              >
                {generatingComparison ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                {t("marketAi.generateComparison")}
              </button>
              <button
                type="button"
                disabled={
                  generatingPpt ||
                  generatingChartPpt ||
                  generatingImages ||
                  generatingComparison
                }
                onClick={() => void generateChartPpt()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm text-accent hover:border-accent/50 disabled:opacity-50"
              >
                {generatingChartPpt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                {t("marketAi.generateChartPpt")}
              </button>
              <button
                type="button"
                disabled={generatingPpt || generatingChartPpt || generatingImages}
                onClick={() => void generatePpt()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-sm text-muted hover:border-accent/40 hover:text-accent disabled:opacity-50"
              >
                {generatingPpt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Presentation className="h-4 w-4" />
                )}
                {t("marketAi.generatePpt")}
              </button>
              <button
                type="button"
                disabled={generatingPpt || generatingChartPpt || generatingImages}
                onClick={() => void generateImages()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-sm text-muted hover:border-accent/40 hover:text-accent disabled:opacity-50"
              >
                {generatingImages ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {t("marketAi.generateImages")}
              </button>
            </div>
            <button
              type="button"
              disabled={sending || !input.trim()}
              onClick={() => void sendMessage()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("marketAi.send")}
            </button>
          </div>
          {genStatus && (
            <p
              className={`text-sm ${
                genStatus.includes("失败") || genStatus.toLowerCase().includes("fail")
                  ? "text-warning"
                  : "text-muted"
              }`}
            >
              {genStatus}
            </p>
          )}
          {!uploading && uploadStatus && (
            <p className="text-sm text-muted">{uploadStatus}</p>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
}
