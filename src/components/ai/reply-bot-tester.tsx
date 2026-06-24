"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Loader2, Send, Trash2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { AgentKnowledgeUpload } from "@/components/ai/agent-knowledge-upload";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { Channel } from "@/types/database";

type ConvTurn = { role: "customer" | "agent"; content: string };

const QUICK_STARTS = [
  "你好，我想了解一下入金",
  "怎么入金？需要准备什么资料？",
  "你们平台安全吗？",
  "How do I deposit?",
];

const channels: Channel[] = ["whatsapp", "wechat", "telegram", "email"];

function formatHistory(turns: ConvTurn[]) {
  return turns
    .map((t) => `${t.role === "customer" ? "Customer" : "Agent"}: ${t.content}`)
    .join("\n");
}

export function ReplyBotTester() {
  const { t } = useLocale();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [testUrl, setTestUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [openaiReady, setOpenaiReady] = useState<boolean | null>(null);
  const [openaiReachable, setOpenaiReachable] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState<string>("openai");
  const [providerLabel, setProviderLabel] = useState("AI");
  const [rechecking, setRechecking] = useState(false);
  const [channel, setChannel] = useState<Channel>("wechat");
  const [clientName, setClientName] = useState("Test Customer");
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<ConvTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptStatus, setPromptStatus] = useState<string | null>(null);

  useEffect(() => {
    setTestUrl(`${window.location.origin}/dashboard/ai-assistant/test`);
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d) => {
        setOpenaiReady(Boolean(d.configured));
        setOpenaiReachable(Boolean(d.reachable));
        setAiProvider(d.provider ?? "openai");
        setProviderLabel(d.providerLabel ?? "AI");
      })
      .catch(() => {
        setOpenaiReady(false);
        setOpenaiReachable(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setAgentPrompt(d.settings?.replyAgentPrompt ?? ""))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, loading]);

  async function recheckOpenAI() {
    setRechecking(true);
    try {
      const res = await fetch("/api/ai/status", { method: "POST" });
      const d = await res.json();
      setOpenaiReady(Boolean(d.configured));
      setOpenaiReachable(Boolean(d.reachable));
      setAiProvider(d.provider ?? "openai");
      setProviderLabel(d.providerLabel ?? "AI");
    } finally {
      setRechecking(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setInput(q);
  }, []);

  const copyLink = useCallback(async () => {
    if (!testUrl) return;
    await navigator.clipboard.writeText(testUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [testUrl]);

  async function saveAgentPrompt() {
    setSavingPrompt(true);
    setPromptStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyAgentPrompt: agentPrompt.trim() || null,
        }),
      });
      setPromptStatus(res.ok ? t("ai.promptSaved") : t("ai.promptSaveFailed"));
    } finally {
      setSavingPrompt(false);
    }
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const historyTurns = [...conversation];
    const historyBeforeLatest = formatHistory(historyTurns);

    setInput("");
    setError(null);
    setLoading(true);
    setConversation((prev) => [...prev, { role: "customer", content: text }]);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 90_000);

    try {
      const res = await fetch("/api/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          channel,
          clientName: clientName.trim() || "Test Customer",
          customerQuestion: text,
          conversationHistory: historyBeforeLatest || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? t("ai.testFailed"),
        );
        return;
      }

      const reply = data.suggestions?.[0];
      if (reply) {
        setConversation((prev) => [...prev, { role: "agent", content: reply }]);
      } else {
        setError(t("ai.testFailed"));
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError(t("ai.testTimeout"));
      } else {
        setError(t("help.pageError"));
      }
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="space-y-4">
      <details className="rounded-lg border border-card-border bg-background/40 px-3 py-2">
        <summary className="cursor-pointer text-xs text-muted">{t("ai.testChatSettings")}</summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted">{t("ai.testClientName")}</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">{t("ai.channel")}</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              >
                {channels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={openaiReady && openaiReachable ? "default" : "muted"}>
              {providerLabel}:{" "}
              {!openaiReady
                ? t("settings.notConfigured")
                : openaiReachable
                  ? t("settings.connected")
                  : t("ai.testOpenAiUnreachable")}
            </Badge>
            <button
              type="button"
              onClick={recheckOpenAI}
              disabled={rechecking}
              className="text-xs text-accent hover:underline disabled:opacity-50"
            >
              {rechecking ? t("ai.recheckingOpenAi") : t("ai.recheckOpenAi")}
            </button>
            <code className="truncate text-[10px] text-muted">{testUrl}</code>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 text-xs text-accent"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t("ai.copied") : t("ai.copyTestLink")}
            </button>
            <Link
              href="/dashboard/conversations?tab=reply-agent"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
            >
              {t("ai.fullAgentPage")}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </details>

      <Card className="border-accent/20 bg-accent/5">
        <CardHeader
          title={t("ai.agentPromptTitle")}
          description={t("ai.agentPromptDesc")}
        />
        <div className="space-y-3">
          <AgentKnowledgeUpload />
          <textarea
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            rows={5}
            placeholder={t("ai.agentPromptPlaceholder")}
            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm min-h-[120px] resize-y"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveAgentPrompt}
              disabled={savingPrompt}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
            >
              {savingPrompt ? t("ai.savingPrompt") : t("ai.saveAgentPrompt")}
            </button>
            <p className="text-[10px] text-muted">{t("ai.agentPromptOrFiles")}</p>
          </div>
          {promptStatus && <p className="text-xs text-muted">{promptStatus}</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={t("ai.testPageTitle")}
          description={t("ai.testPageDesc")}
          action={
            conversation.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setConversation([]);
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("ai.testConvClear")}
              </button>
            ) : undefined
          }
        />

        <div className="flex min-h-[420px] flex-col rounded-lg border border-card-border bg-background/30">
          <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[480px]">
            {conversation.length === 0 && !loading && (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted">{t("ai.testConvEmpty")}</p>
                <div className="flex flex-wrap justify-center gap-2 px-2">
                  {QUICK_STARTS.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => void sendMessage(sample)}
                      className="rounded-full border border-card-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {conversation.map((turn, i) => (
              <div
                key={i}
                className={`flex ${turn.role === "customer" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`group relative max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    turn.role === "customer"
                      ? "rounded-bl-md bg-accent/10 text-foreground"
                      : "rounded-br-md bg-accent text-white"
                  }`}
                >
                  <p className="mb-0.5 text-[10px] font-medium opacity-70">
                    {turn.role === "customer" ? t("ai.testConvCustomer") : t("ai.testConvAgent")}
                  </p>
                  <p className="whitespace-pre-wrap">{turn.content}</p>
                  {turn.role === "agent" && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(turn.content)}
                      className="absolute -bottom-5 right-0 text-[10px] text-muted opacity-0 group-hover:opacity-100"
                    >
                      {t("ai.copy")}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-br-md bg-accent/20 px-4 py-2 text-sm text-muted">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("ai.testChatTyping")}
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {error && (
            <p className="border-t border-card-border px-4 py-2 text-xs text-danger">{error}</p>
          )}

          <div className="border-t border-card-border p-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={loading}
                placeholder={t("ai.testChatPlaceholder")}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-card-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={loading || !input.trim()}
                className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-muted disabled:opacity-50"
                aria-label={t("ai.testChatSend")}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted">{t("ai.testChatHint")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
