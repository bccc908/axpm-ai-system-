"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, MessageSquare, Plus, Send, Sparkles, Trash2, Upload } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VoiceTextarea } from "@/components/ui/voice-field";
import { formatDateLocalized } from "@/lib/i18n";
import type { ConversationMessage, ConversationThread } from "@/types/conversation";
import type { Client } from "@/types/database";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted transition-colors disabled:opacity-50";

export function ConversationRecorder({ onSaved }: { onSaved?: () => void }) {
  const { t, locale } = useLocale();
  const [clients, setClients] = useState<Client[]>([]);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paste, setPaste] = useState("");
  const [myName, setMyName] = useState("");
  const [quickContent, setQuickContent] = useState("");
  const [quickDirection, setQuickDirection] = useState<"inbound" | "outbound">("inbound");
  const [status, setStatus] = useState<string | null>(null);
  const [sendContent, setSendContent] = useState("");
  const [sendingWork, setSendingWork] = useState(false);
  const [workReady, setWorkReady] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<"wechat" | "web">("wechat");

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const loadWorkStatus = useCallback(async () => {
    const res = await fetch("/api/wechat-work/status");
    const data = await res.json();
    setWorkReady(Boolean(data.wechatWork?.canSend));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clientRes, convRes] = await Promise.all([
        fetch("/api/clients"),
        fetch(
          selectedClientId
            ? `/api/conversations?client_id=${selectedClientId}&channel=${channelFilter}&limit=200`
            : `/api/conversations?channel=${channelFilter}&limit=50`,
        ),
      ]);
      const [clientData, convData] = await Promise.all([clientRes.json(), convRes.json()]);
      setClients(clientData.clients ?? []);
      setThreads(convData.threads ?? []);
      setMessages(convData.messages ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, channelFilter]);

  useEffect(() => {
    load();
    loadWorkStatus();
  }, [load, loadWorkStatus]);

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      const withWechat = clients.find((c) => c.wechat);
      setSelectedClientId(withWechat?.id ?? clients[0].id);
    }
  }, [clients, selectedClientId]);

  async function handleImport() {
    if (!selectedClient || !paste.trim()) return;
    setImporting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/conversations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient.id,
          client_name: selectedClient.name,
          wechat_id: selectedClient.wechat,
          paste: paste.trim(),
          my_name: myName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.imported) {
        setStatus(t("conversations.imported", { count: data.imported }));
        setPaste("");
        load();
        onSaved?.();
      } else {
        setStatus(data.error ?? t("conversations.importFailed"));
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleQuickSave() {
    if (!selectedClient || !quickContent.trim()) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/conversations/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient.id,
          client_name: selectedClient.name,
          wechat_id: selectedClient.wechat,
          channel: "wechat",
          direction: quickDirection,
          sender_label:
            quickDirection === "outbound"
              ? myName.trim() || t("conversations.me")
              : selectedClient.name,
          content: quickContent.trim(),
        }),
      });
      if (res.ok) {
        setQuickContent("");
        setStatus(t("conversations.saved"));
        load();
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleWeChatWorkSend() {
    if (!selectedClient || !sendContent.trim()) return;
    setSendingWork(true);
    setStatus(null);
    try {
      const res = await fetch("/api/wechat-work/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient.id,
          content: sendContent.trim(),
        }),
      });
      const data = await res.json();
      if (data.sent) {
        setSendContent("");
        setStatus(t("conversations.workSent"));
        load();
        onSaved?.();
      } else {
        setStatus(data.error ?? t("conversations.workSendFailed"));
      }
    } finally {
      setSendingWork(false);
    }
  }

  async function deleteMsg(id: string) {
    await fetch(`/api/conversations/messages/${id}`, { method: "DELETE" });
    load();
  }

  async function handleSummarize() {
    if (!selectedClient || sortedMessages.length === 0) return;
    setSummarizing(true);
    setSummary(null);
    setStatus(null);
    try {
      const transcript = sortedMessages
        .map((m) => `${m.sender_label}: ${m.content}`)
        .join("\n");
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: selectedClient.name,
          messages: transcript,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : t("conversations.summarizeFailed"));
        return;
      }
      setSummary(data.summary ?? data.text ?? null);
    } finally {
      setSummarizing(false);
    }
  }

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("conversations.title")}</h1>
        <p className="mt-1 text-muted">{t("conversations.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChannelFilter("wechat")}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            channelFilter === "wechat"
              ? "bg-accent/15 text-accent"
              : "border border-card-border text-muted hover:text-foreground"
          }`}
        >
          {t("conversations.channelWechat")}
        </button>
        <button
          type="button"
          onClick={() => setChannelFilter("web")}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            channelFilter === "web"
              ? "bg-accent/15 text-accent"
              : "border border-card-border text-muted hover:text-foreground"
          }`}
        >
          {t("conversations.channelWebsite")}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title={t("conversations.threads")} description={t("conversations.threadsDesc")} />
          {loading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />
          ) : threads.length === 0 ? (
            <p className="text-sm text-muted">{t("conversations.noThreads")}</p>
          ) : (
            <div className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.client_id ?? thread.wechat_id ?? thread.client_name}
                  type="button"
                  onClick={() => thread.client_id && setSelectedClientId(thread.client_id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    thread.client_id === selectedClientId
                      ? "border-accent/50 bg-accent/10"
                      : "border-card-border hover:bg-background/50"
                  }`}
                >
                  <p className="font-medium text-foreground">{thread.client_name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{thread.last_preview}</p>
                  <p className="mt-1 text-xs text-muted">
                    {thread.message_count} {t("conversations.messages")} ·{" "}
                    {formatDateLocalized(thread.last_message_at, locale)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader
              title={t("conversations.workSendTitle")}
              description={t("conversations.workSendDesc")}
            />
            <div className="space-y-3">
              <select
                className={inputClass}
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.wechat ? ` (${c.wechat})` : ""}
                  </option>
                ))}
              </select>
              {!selectedClient?.wechat && selectedClient && (
                <p className="text-xs text-warning">{t("conversations.workNoId")}</p>
              )}
              <VoiceTextarea
                className={`${inputClass} min-h-[80px] resize-y`}
                placeholder={t("conversations.workMessagePlaceholder")}
                value={sendContent}
                onValueChange={setSendContent}
              />
              <button
                type="button"
                onClick={handleWeChatWorkSend}
                disabled={sendingWork || !sendContent.trim() || !selectedClient?.wechat || !workReady}
                className={btnPrimary}
              >
                {sendingWork ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("conversations.workSendBtn")}
              </button>
              {!workReady && (
                <p className="text-xs text-muted">{t("conversations.workNotConfigured")}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("conversations.importTitle")} description={t("conversations.importDesc")} />
            <div className="space-y-3">
              <select
                className={inputClass}
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.wechat ? ` (${c.wechat})` : ""}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                placeholder={t("conversations.myNamePlaceholder")}
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
              />
              <VoiceTextarea
                className={`${inputClass} min-h-[140px] resize-y font-mono text-xs`}
                placeholder={t("conversations.pastePlaceholder")}
                value={paste}
                onValueChange={setPaste}
              />
              <p className="text-xs text-muted">{t("conversations.pasteHint")}</p>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || !paste.trim() || !selectedClientId}
                className={btnPrimary}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t("conversations.importBtn")}
              </button>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("conversations.quickLog")} description={t("conversations.quickLogDesc")} />
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickDirection("inbound")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                    quickDirection === "inbound"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-card-border text-muted"
                  }`}
                >
                  {t("conversations.fromClient")}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDirection("outbound")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                    quickDirection === "outbound"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-card-border text-muted"
                  }`}
                >
                  {t("conversations.fromMe")}
                </button>
              </div>
              <VoiceTextarea
                className={`${inputClass} min-h-[80px] resize-y`}
                placeholder={t("conversations.messagePlaceholder")}
                value={quickContent}
                onValueChange={setQuickContent}
              />
              <button
                type="button"
                onClick={handleQuickSave}
                disabled={saving || !quickContent.trim()}
                className={btnPrimary}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("conversations.saveMessage")}
              </button>
            </div>
          </Card>

          {status && <p className="text-sm text-accent">{status}</p>}

          <Card>
            <CardHeader
              title={t("conversations.history")}
              description={
                selectedClient
                  ? `${selectedClient.name}${selectedClient.wechat ? ` · ${selectedClient.wechat}` : ""}`
                  : ""
              }
              action={
                sortedMessages.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleSummarize}
                    disabled={summarizing}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
                  >
                    {summarizing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {t("conversations.aiSummarize")}
                  </button>
                ) : undefined
              }
            />
            {summary && (
              <div className="mb-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm whitespace-pre-wrap">
                <p className="mb-1 text-xs font-medium text-accent">{t("conversations.aiSummary")}</p>
                {summary}
              </div>
            )}
            {sortedMessages.length === 0 ? (
              <p className="text-sm text-muted">{t("conversations.noMessages")}</p>
            ) : (
              <div className="max-h-[480px] space-y-3 overflow-y-auto">
                {sortedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg border px-3 py-2 ${
                        msg.direction === "outbound"
                          ? "border-accent/30 bg-accent/10"
                          : "border-card-border bg-background/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">{msg.sender_label}</p>
                        <Badge variant="muted">{msg.source}</Badge>
                        <button
                          type="button"
                          className="ml-auto text-muted hover:text-danger"
                          onClick={() => deleteMsg(msg.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{msg.content}</p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDateLocalized(msg.sent_at, locale)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={t("conversations.autoCapture")} description={t("conversations.autoCaptureDesc")} />
            <div className="space-y-2 text-sm text-muted">
              <p className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                {t("conversations.methodPaste")}
              </p>
              <p className="flex items-center gap-2">
                <Download className="h-4 w-4 text-accent" />
                {t("conversations.methodWork")}
              </p>
              <p className="text-xs break-all">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/api/webhooks/wechat-work`
                  : "/api/webhooks/wechat-work"}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
