"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  ChevronDown,
  FlaskConical,
  Globe,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";
import { CustomerReplyAgent } from "@/components/ai/customer-reply-agent";
import { ConversationRecorder } from "@/components/conversations/conversation-recorder";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ConversationMessage } from "@/types/conversation";
import type { InboxAnalytics, InboxSession } from "@/types/inbox";
import type { Channel } from "@/types/database";
import { cn } from "@/lib/utils";

type SessionRow = InboxSession & { assigned_name?: string | null };
type Filter = "all" | "open" | "bot" | "human" | "closed";

const channelIcon: Partial<Record<Channel, typeof MessageSquare>> = {
  web: Globe,
  wechat: MessageSquare,
  whatsapp: MessageSquare,
};

function statusVariant(status: InboxSession["status"]) {
  if (status === "bot") return "default" as const;
  if (status === "human") return "warning" as const;
  return "muted" as const;
}

type PageTab = "inbox" | "reply-agent";

export function ConversationalInbox() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageTab: PageTab =
    searchParams.get("tab") === "reply-agent" ? "reply-agent" : "inbox";
  const initialClientId = searchParams.get("client") ?? undefined;

  const selectPageTab = (tab: PageTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "reply-agent") params.set("tab", "reply-agent");
    else params.delete("tab");
    const query = params.toString();
    router.replace(query ? `/dashboard/conversations?${query}` : "/dashboard/conversations", {
      scroll: false,
    });
  };
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [analytics, setAnalytics] = useState<InboxAnalytics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId],
  );

  const loadSessions = useCallback(async (silent = false) => {
    const statusParam =
      filter === "all" ? "" : filter === "open" ? "open" : filter;
    const params = new URLSearchParams();
    if (statusParam) params.set("status", statusParam);
    if (channelFilter !== "all") params.set("channel", channelFilter);

    const [sessRes, statsRes, teamRes] = await Promise.all([
      fetch(`/api/inbox/sessions?${params}`),
      fetch("/api/inbox/analytics"),
      fetch("/api/team"),
    ]);
    const sessData = await sessRes.json();
    const statsData = await statsRes.json();
    const teamData = await teamRes.json();
    setSessions(sessData.sessions ?? []);
    setAnalytics(statsData.analytics ?? null);
    setTeamMembers(teamData.teamMembers ?? []);
    if (!silent) setLoading(false);
  }, [filter, channelFilter]);

  const fetchThread = useCallback(async (sessionId: string, markRead = false) => {
    const res = await fetch(`/api/inbox/sessions/${sessionId}`);
    const data = await res.json();
    if (!res.ok) return;
    setMessages(data.messages ?? []);
    if (markRead) {
      await fetch(`/api/inbox/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_read: true }),
      });
    }
  }, []);

  const loadThread = useCallback(async (sessionId: string) => {
    setThreadLoading(true);
    try {
      await fetchThread(sessionId, true);
      await loadSessions(true);
    } finally {
      setThreadLoading(false);
    }
  }, [fetchThread, loadSessions]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadSessions();
    })();
  }, [loadSessions]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      void loadSessions(true);
      if (selectedId) void fetchThread(selectedId);
    }, 5000);
    return () => clearInterval(timer);
  }, [live, loadSessions, selectedId, fetchThread]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
    else setMessages([]);
  }, [selectedId, loadThread]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedId && sessions.length > 0) {
      setSelectedId(sessions[0].id);
    }
  }, [sessions, selectedId]);

  async function patchSession(body: Record<string, unknown>) {
    if (!selectedId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/inbox/sessions/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.session) {
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedId ? { ...s, ...data.session } : s)),
        );
      }
      await loadSessions();
    } finally {
      setActionLoading(false);
    }
  }

  async function generateDraft() {
    if (!selectedId) return;
    setDrafting(true);
    try {
      const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
      const q = lastInbound ? `?last_inbound=${encodeURIComponent(lastInbound.content)}` : "";
      const res = await fetch(`/api/inbox/sessions/${selectedId}/reply${q}`);
      const data = await res.json();
      if (data.draft) setReply(data.draft);
    } finally {
      setDrafting(false);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setSendStatus(null);
    try {
      const res = await fetch(`/api/inbox/sessions/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setReply("");
        setSendStatus(t("inbox.sendSuccess"));
        await loadThread(selectedId);
        await loadSessions(true);
      } else {
        setSendStatus(typeof data.error === "string" ? data.error : t("inbox.sendFailed"));
      }
    } finally {
      setSending(false);
    }
  }

  const deliverHint =
    selected?.channel === "wechat"
      ? t("inbox.deliverWechat")
      : selected?.channel === "whatsapp"
        ? t("inbox.deliverWhatsapp")
        : selected?.channel === "web"
          ? t("inbox.deliverWeb")
          : null;

  const filters: { id: Filter; label: string }[] = [
    { id: "open", label: t("inbox.filterOpen") },
    { id: "bot", label: t("inbox.filterBot") },
    { id: "human", label: t("inbox.filterHuman") },
    { id: "closed", label: t("inbox.filterClosed") },
    { id: "all", label: t("inbox.filterAll") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("nav.conversations")}</h1>
          <p className="mt-1 text-sm text-muted">{t("inbox.subtitle")}</p>
        </div>
        {pageTab === "inbox" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                live
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-card-border text-muted hover:bg-card-border/30",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  live ? "bg-success animate-pulse" : "bg-muted",
                )}
              />
              {live ? t("inbox.liveOn") : t("inbox.liveOff")}
            </button>
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="rounded-lg border border-card-border px-3 py-2 text-sm hover:bg-card-border/30"
            >
              {showImport ? t("inbox.hideImport") : t("inbox.showImport")}
            </button>
            <Link
              href="/dashboard/ai-assistant/test"
              className="inline-flex items-center gap-2 rounded-lg border border-card-border px-3 py-2 text-sm hover:bg-card-border/30"
            >
              <FlaskConical className="h-4 w-4" />
              {t("ai.openTestPage")}
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-card-border pb-1">
        {(
          [
            { id: "inbox" as const, label: t("inbox.tabInbox") },
            { id: "reply-agent" as const, label: t("inbox.tabReplyAgent") },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectPageTab(item.id)}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              pageTab === item.id
                ? "bg-card text-accent border border-card-border border-b-transparent -mb-px"
                : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {pageTab === "reply-agent" ? (
        <CustomerReplyAgent initialClientId={initialClientId} />
      ) : (
        <>

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: t("inbox.statOpen"), value: analytics.openSessions },
            { label: t("inbox.statBot"), value: analytics.botSessions },
            { label: t("inbox.statHuman"), value: analytics.humanSessions },
            { label: t("inbox.statMessages"), value: analytics.totalMessages },
            { label: t("inbox.statAutomation"), value: `${analytics.automationRate}%` },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs text-muted">{item.label}</p>
              <p className="mt-1 text-xl font-bold text-foreground">{item.value}</p>
            </Card>
          ))}
        </div>
      )}

      {showImport && (
        <Card className="p-4">
          <ConversationRecorder onSaved={() => void loadSessions()} />
        </Card>
      )}

      <div className="grid min-h-[560px] gap-0 overflow-hidden rounded-xl border border-card-border bg-card lg:grid-cols-[280px_1fr_300px]">
        {/* Session list */}
        <div className="border-b border-card-border lg:border-b-0 lg:border-r">
          <div className="border-b border-card-border p-3 space-y-2">
            <div className="flex flex-wrap gap-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium",
                    filter === f.id
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:bg-card-border/40",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-lg border border-card-border bg-background px-3 py-2 pr-8 text-xs"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as Channel | "all")}
              >
                <option value="all">{t("inbox.allChannels")}</option>
                <option value="web">{t("inbox.channelWeb")}</option>
                <option value="wechat">{t("inbox.channelWechat")}</option>
                <option value="whatsapp">{t("inbox.channelWhatsapp")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted" />
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">{t("inbox.noSessions")}</p>
            ) : (
              sessions.map((session) => {
                const Icon = channelIcon[session.channel] ?? MessageSquare;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedId(session.id)}
                    className={cn(
                      "w-full border-b border-card-border px-3 py-3 text-left transition-colors hover:bg-background/60",
                      selectedId === session.id && "bg-accent/10",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate font-medium text-foreground">
                          {session.client_name}
                        </span>
                      </div>
                      {session.unread_count > 0 && (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {session.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{session.last_preview}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={statusVariant(session.status)}>
                        {t(`inbox.status.${session.status}`)}
                      </Badge>
                      <span className="text-[10px] text-muted">
                        {new Date(session.last_message_at).toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex flex-col border-b border-card-border lg:border-b-0 lg:border-r">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
              {t("inbox.selectSession")}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
                <div>
                  <p className="font-semibold text-foreground">{selected.client_name}</p>
                  <p className="text-xs text-muted capitalize">{selected.channel}</p>
                </div>
                {selected.client_id && (
                  <Link
                    href={`/dashboard/clients/${selected.client_id}`}
                    className="text-xs text-accent hover:underline"
                  >
                    {t("inbox.openContact")}
                  </Link>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[380px]">
                {threadLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted">{t("inbox.noMessages")}</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                        msg.direction === "outbound"
                          ? "ml-auto bg-accent/15 text-foreground"
                          : "bg-background border border-card-border text-foreground",
                      )}
                    >
                      <p className="text-[10px] font-medium text-muted mb-1">
                        {msg.sender_label}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className="mt-1 text-[10px] text-muted">
                        {new Date(msg.sent_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>
            </>
          )}
        </div>

        {/* Agent panel */}
        <div className="flex flex-col p-4">
          {!selected ? (
            <p className="text-sm text-muted">{t("inbox.agentPanelHint")}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("inbox.handoffTitle")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.status !== "human" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void patchSession({ status: "human" })}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-warning/15 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/25 disabled:opacity-50"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {t("inbox.takeOver")}
                    </button>
                  )}
                  {selected.status === "human" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void patchSession({ status: "bot" })}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-50"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      {t("inbox.releaseToBot")}
                    </button>
                  )}
                  {selected.status !== "closed" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void patchSession({ status: "closed" })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs hover:bg-card-border/30 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {t("inbox.closeSession")}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted">{t("inbox.assignAgent")}</label>
                <select
                  className="mt-1 w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
                  value={selected.assigned_to ?? ""}
                  onChange={(e) =>
                    void patchSession({
                      assigned_to: e.target.value || null,
                      status: selected.status === "closed" ? "human" : selected.status,
                    })
                  }
                >
                  <option value="">{t("inbox.unassigned")}</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("inbox.replyTitle")}
                  </p>
                  <button
                    type="button"
                    disabled={drafting}
                    onClick={() => void generateDraft()}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
                  >
                    {drafting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {t("inbox.aiDraft")}
                  </button>
                </div>
                <textarea
                  className="mt-2 min-h-[120px] w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={t("inbox.replyPlaceholder")}
                />
                <button
                  type="button"
                  disabled={sending || !reply.trim()}
                  onClick={() => void sendReply()}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t("inbox.sendReply")}
                </button>
                {deliverHint && (
                  <p className="mt-2 text-xs text-muted">{deliverHint}</p>
                )}
                {sendStatus && (
                  <p
                    className={cn(
                      "mt-2 text-xs",
                      sendStatus === t("inbox.sendSuccess") ? "text-success" : "text-danger",
                    )}
                  >
                    {sendStatus}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-card-border bg-background/50 p-3 text-xs text-muted">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <User className="h-3.5 w-3.5" />
                  {t("inbox.statusLabel")}: {t(`inbox.status.${selected.status}`)}
                </p>
                {selected.assigned_name && (
                  <p className="mt-1">
                    {t("inbox.assignedTo")}: {selected.assigned_name}
                  </p>
                )}
                {selected.status === "human" && (
                  <p className="mt-2 text-warning">{t("inbox.humanModeHint")}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
