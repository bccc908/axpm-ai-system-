"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { AgentKnowledgeUpload } from "@/components/ai/agent-knowledge-upload";
import { VoiceTextarea } from "@/components/ui/voice-field";
import type { Channel } from "@/types/database";

type ClientRow = {
  id: string;
  name: string;
  whatsapp: string | null;
  wechat: string | null;
  notes: string | null;
};

const channels: Channel[] = ["whatsapp", "wechat", "telegram", "email"];

const channelLabel: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  wechat: "WeChat",
  telegram: "Telegram",
  email: "Email",
  phone: "Phone",
  web: "Website",
};

export function CustomerReplyAgent({
  clients: clientsProp,
  initialClientId,
  compact,
}: {
  clients?: ClientRow[];
  initialClientId?: string;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const [clients, setClients] = useState<ClientRow[]>(clientsProp ?? []);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [guestName, setGuestName] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [customerQuestion, setCustomerQuestion] = useState("");
  const [history, setHistory] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "concise">("professional");
  const [replies, setReplies] = useState<string[]>([]);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [openaiReady, setOpenaiReady] = useState<boolean | null>(null);
  const [openaiReachable, setOpenaiReachable] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState<string>("openai");
  const [providerLabel, setProviderLabel] = useState("AI");
  const [usedDocFallback, setUsedDocFallback] = useState(false);
  const [replyNotice, setReplyNotice] = useState<string | null>(null);
  const [draftInfo, setDraftInfo] = useState<{
    id: string;
    status: string;
    notifiedTelegram: boolean;
    telegramError: string | null;
  } | null>(null);

  const selectedClient = clients.find((c) => c.id === clientId);
  const clientName =
    selectedClient?.name ?? (guestName.trim() || t("ai.guestClient"));

  const loadClients = useCallback(async () => {
    if (clientsProp?.length) return;
    const res = await fetch("/api/clients");
    const data = await res.json();
    const rows = (data.clients ?? []).map(
      (c: ClientRow) => ({
        id: c.id,
        name: c.name,
        whatsapp: c.whatsapp,
        wechat: c.wechat,
        notes: c.notes,
      }),
    );
    setClients(rows);
    if (!clientId && rows.length > 0) {
      setClientId(initialClientId ?? rows[0].id);
    }
  }, [clientsProp, clientId, initialClientId]);

  const loadHistory = useCallback(async () => {
    if (!clientId) return;
    const res = await fetch(
      `/api/conversations?client_id=${clientId}&channel=${channel}&limit=40`,
    );
    const data = await res.json();
    const msgs = (data.messages ?? []) as {
      sender_label: string;
      content: string;
      direction: string;
      sent_at: string;
    }[];
    if (msgs.length === 0) {
      setHistory("");
      return;
    }
    const text = msgs
      .slice()
      .reverse()
      .map((m) => `${m.sender_label}: ${m.content}`)
      .join("\n");
    setHistory(text);
  }, [clientId, channel]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setAgentPrompt(d.settings?.replyAgentPrompt ?? ""))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
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

  async function saveAgentPrompt() {
    setSavingPrompt(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyAgentPrompt: agentPrompt.trim() || null,
        }),
      });
      setStatus(res.ok ? t("ai.promptSaved") : t("ai.promptSaveFailed"));
    } finally {
      setSavingPrompt(false);
    }
  }

  useEffect(() => {
    if (initialClientId) setClientId(initialClientId);
  }, [initialClientId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function useLatestInbound() {
    if (!clientId) return;
    const res = await fetch(
      `/api/conversations?client_id=${clientId}&channel=${channel}&limit=40`,
    );
    const data = await res.json();
    const msgs = (data.messages ?? []) as { direction: string; content: string }[];
    const last = [...msgs].reverse().find((m) => m.direction === "inbound");
    if (last) {
      setCustomerQuestion(last.content);
      setStatus(t("ai.usedLatestQuestion"));
    } else {
      setStatus(t("ai.noInboundYet"));
    }
  }

  async function handleGenerate() {
    if (!customerQuestion.trim()) {
      setStatus(t("ai.questionRequired"));
      return;
    }
    setLoading(true);
    setReplies([]);
    setReplyNotice(null);
    setUsedDocFallback(false);
    setDraftInfo(null);
    setStatus(t("ai.testGeneratingHint"));

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 90_000);

    try {
      const replyUrl = "/api/ai/reply";
      const res = await fetch(replyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          channel,
          clientName,
          clientId: clientId || undefined,
          customerQuestion: customerQuestion.trim(),
          conversationHistory: history || undefined,
          clientNotes: selectedClient?.notes ?? undefined,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg =
          typeof data.error === "string"
            ? data.error
            : t("ai.sendFailed");
        setReplies([errMsg]);
        setStatus(null);
        return;
      }
      setReplies(data.suggestions ?? []);
      setDetectedLanguage(data.detectedLanguage ?? null);
      setUsedDocFallback(Boolean(data.usedTrainingDocs));
      setReplyNotice(typeof data.notice === "string" ? data.notice : null);
      if (data.draft?.id) {
        setDraftInfo({
          id: data.draft.id,
          status: data.draft.status,
          notifiedTelegram: Boolean(data.draft.notifiedTelegram),
          telegramError: data.draft.telegramError ?? null,
        });
        setStatus(
          data.draft.status === "pending_approval"
            ? "Draft saved as pending approval. It has not been sent to the client."
            : null,
        );
      } else {
        setStatus(null);
      }
    } catch (err) {
      setReplies([
        err instanceof Error && err.name === "AbortError"
          ? t("ai.testTimeout")
          : t("help.pageError"),
      ]);
      setStatus(null);
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }

  async function copyText(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }


  async function saveToLog(content: string) {
    if (!clientId) {
      setStatus(t("ai.pickClientToSave"));
      return;
    }
    const res = await fetch("/api/conversations/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_name: selectedClient?.name,
        channel,
        direction: "outbound",
        sender_label: t("conversations.me"),
        content,
      }),
    });
    setStatus(res.ok ? t("ai.savedToLog") : t("ai.saveFailed"));
  }

  const replyLabels = [t("ai.bestReply"), t("ai.altReply"), t("ai.followUpReply")];

  return (
    <Card className={compact ? "border-accent/30" : undefined}>
      <CardHeader title={t("ai.agentTitle")} description={t("ai.agentSubtitle")} />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("ai.client")}</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">{t("ai.noClient")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {!clientId && (
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t("ai.guestNamePlaceholder")}
                className="mt-2 w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("ai.channel")}</label>
            <div className="flex flex-wrap gap-2">
              {channels.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                    channel === ch
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-card-border text-muted hover:text-foreground"
                  }`}
                >
                  {channelLabel[ch]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-muted">{t("ai.customerQuestion")}</label>
            {clientId && (
              <button
                type="button"
                onClick={useLatestInbound}
                className="text-xs text-accent hover:underline"
              >
                {t("ai.useLatestInbound")}
              </button>
            )}
          </div>
          <VoiceTextarea
            value={customerQuestion}
            onValueChange={setCustomerQuestion}
            rows={compact ? 3 : 4}
            placeholder={t("ai.customerQuestionPlaceholder")}
            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 min-h-[88px] resize-y"
          />
        </div>

        {!compact && (
          <details className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              {t("ai.agentPromptTitle")}
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted">{t("ai.agentPromptDesc")}</p>
              <AgentKnowledgeUpload />
              <VoiceTextarea
                value={agentPrompt}
                onValueChange={setAgentPrompt}
                rows={6}
                placeholder={t("ai.agentPromptPlaceholder")}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm min-h-[120px] resize-y"
              />
              <p className="text-[10px] text-muted">{t("ai.agentPromptOrFiles")}</p>
              <button
                type="button"
                onClick={saveAgentPrompt}
                disabled={savingPrompt}
                className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-accent hover:bg-card disabled:opacity-50"
              >
                {savingPrompt ? t("ai.savingPrompt") : t("ai.saveAgentPrompt")}
              </button>
            </div>
          </details>
        )}

        <details className="rounded-lg border border-card-border bg-background/30 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted">
            {t("ai.extraContext")}
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted">{t("ai.tone")}</label>
              <select
                value={tone}
                onChange={(e) =>
                  setTone(e.target.value as "professional" | "friendly" | "concise")
                }
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
              >
                <option value="professional">{t("ai.toneProfessional")}</option>
                <option value="friendly">{t("ai.toneFriendly")}</option>
                <option value="concise">{t("ai.toneConcise")}</option>
              </select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-muted">{t("ai.context")}</label>
                {clientId && (
                  <button
                    type="button"
                    onClick={loadHistory}
                    className="text-xs text-accent"
                  >
                    {t("ai.reloadHistory")}
                  </button>
                )}
              </div>
              <VoiceTextarea
                value={history}
                onValueChange={setHistory}
                rows={4}
                placeholder={t("ai.contextPlaceholder")}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm min-h-[72px] resize-y"
              />
            </div>
            {selectedClient?.notes && (
              <p className="text-xs text-muted">
                <span className="font-medium">{t("ai.crmNotes")}: </span>
                {selectedClient.notes}
              </p>
            )}
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={openaiReady && openaiReachable ? "default" : "muted"}>
            {providerLabel}:{" "}
            {!openaiReady
              ? t("settings.notConfigured")
              : openaiReachable
                ? t("settings.connected")
                : t("ai.testOpenAiUnreachable")}
          </Badge>
          {openaiReady && !openaiReachable && (
            <Badge variant="muted">{t("ai.replyUsesUploadedDocs")}</Badge>
          )}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !customerQuestion.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50 transition-colors sm:w-auto"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? t("ai.testGenerating") : t("ai.generateReply")}
        </button>

        <div className="flex flex-wrap gap-2">
          {detectedLanguage && (
            <Badge variant="muted">{t("ai.detectedLang", { lang: detectedLanguage })}</Badge>
          )}
          {usedDocFallback && (
            <Badge variant="muted">{t("ai.replyFromTrainingDoc")}</Badge>
          )}
        </div>

        {status && <p className="text-xs text-muted">{status}</p>}

        {replyNotice && (
          <p
            className={`rounded-lg border px-3 py-2 text-xs ${
              usedDocFallback
                ? "border-accent/40 bg-accent/10 text-foreground"
                : "border-card-border bg-background text-muted"
            }`}
          >
            {replyNotice}
          </p>
        )}

        {replies.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted">{t("ai.agentReplies")}</p>
            {replies.map((reply, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${
                  i === 0 ? "border-accent/40 bg-accent/5" : "border-card-border bg-background/50"
                }`}
              >
                <Badge variant={i === 0 ? "default" : "muted"} className="mb-2">
                  {replyLabels[i] ?? t("ai.option", { n: i + 1 })}
                </Badge>
                <p className="whitespace-pre-wrap text-sm text-foreground/90">{reply}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => copyText(reply, i)}
                    className="inline-flex items-center gap-1 text-xs text-accent"
                  >
                    {copied === i ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied === i ? t("ai.copied") : t("ai.copy")}
                  </button>
                  {clientId && (
                    <button
                      type="button"
                      onClick={() => saveToLog(reply)}
                      className="inline-flex items-center gap-1 text-xs text-accent"
                    >
                      <MessageSquare className="h-3 w-3" />
                      {t("ai.saveToLog")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {draftInfo && (
          <p className="text-xs text-amber-200">
            Stored draft {draftInfo.id} · {draftInfo.status.replaceAll("_", " ")}
            {draftInfo.notifiedTelegram
              ? " · notice sent to Kayden's Telegram"
              : draftInfo.telegramError
                ? ` · Telegram notice not sent (${draftInfo.telegramError})`
                : " · Telegram notice not sent"}
            .{" "}
            <Link href="/dashboard/conversations#reply-drafts" className="text-accent hover:underline">
              Review in CRM
            </Link>
            . Approving does not send to the client.
          </p>
        )}

        {!compact && (
          <p className="text-xs text-muted">
            {t("ai.openAiHint")}{" "}
            <Link href="/dashboard/settings" className="text-accent hover:underline">
              {t("nav.settings")}
            </Link>
          </p>
        )}
      </div>
    </Card>
  );
}
