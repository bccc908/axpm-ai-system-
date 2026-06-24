"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
  sentAt?: string;
};

type WidgetConfig = {
  enabled: boolean;
  title: string;
  subtitle: string;
  welcomeMessage: string;
  buttonLabel: string;
  primaryColor: string;
  apiBase: string;
  messages?: ChatMessage[];
  clientName?: string | null;
  humanHandling?: boolean;
};

const SESSION_KEY = "axpm_widget_session";
const NAME_KEY = "axpm_widget_name";

function loadSessionId() {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function loadVisitorName() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

function widgetCopy(zh: boolean) {
  return zh
    ? {
        close: "关闭",
        typing: "正在输入…",
        placeholder: "输入您的问题…",
        namePlaceholder: "您的称呼（可选）",
        nameContinue: "开始聊天",
        disabled: "客服暂时不可用",
        sendFailed: "发送失败，请重试",
        unavailable: "客服加载失败",
        poweredBy: "信号旗 AI",
        humanHandling: "客服专员已接入，请稍候…",
        liveRefresh: "正在同步新消息…",
      }
    : {
        close: "Close",
        typing: "Typing…",
        placeholder: "Type your question…",
        namePlaceholder: "Your name (optional)",
        nameContinue: "Start chat",
        disabled: "Chat is temporarily unavailable",
        sendFailed: "Send failed — please try again",
        unavailable: "Chat unavailable",
        poweredBy: "信号旗 AI",
        humanHandling: "A team member is handling your chat — replies appear here automatically",
        liveRefresh: "Checking for new messages…",
      };
}

export function WebsiteChatWidget({ embed }: { embed?: boolean }) {
  const zh = useMemo(
    () => typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh"),
    [],
  );
  const copy = widgetCopy(zh);

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [open, setOpen] = useState(Boolean(embed));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [visitorName, setVisitorName] = useState(loadVisitorName);
  const [nameDraft, setNameDraft] = useState(loadVisitorName);
  const [showNameStep, setShowNameStep] = useState(!loadVisitorName());
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(loadSessionId);
  const [humanHandling, setHumanHandling] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const apiBase = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return (params.get("api") || window.location.origin).replace(/\/$/, "");
  }, []);

  const pageUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    return params.get("page") || document.referrer || undefined;
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/api/public/chat?sessionId=${encodeURIComponent(sessionId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : copy.unavailable);
      }

      const cfg = data as WidgetConfig;
      setConfig(cfg);

      const history = Array.isArray(cfg.messages) ? cfg.messages : [];
      if (history.length > 0) {
        setMessages(history);
        setShowNameStep(false);
        const latest = history[history.length - 1];
        if (latest?.sentAt) setLastSeenAt(latest.sentAt);
      } else {
        setMessages([{ role: "assistant", content: cfg.welcomeMessage }]);
      }

      setHumanHandling(Boolean(cfg.humanHandling));

      if (cfg.clientName && cfg.clientName !== "Website visitor") {
        setVisitorName(cfg.clientName);
        setNameDraft(cfg.clientName);
        setShowNameStep(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unavailable);
    } finally {
      setLoading(false);
    }
  }, [apiBase, sessionId, copy.unavailable]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, showNameStep]);

  const mergeIncoming = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(
        prev.filter((m) => m.sentAt).map((m) => `${m.role}:${m.sentAt}:${m.content}`),
      );
      const next = [...prev];
      for (const msg of incoming) {
        const key = msg.sentAt ? `${msg.role}:${msg.sentAt}:${msg.content}` : `${msg.role}:${msg.content}`;
        if (msg.sentAt && seen.has(`${msg.role}:${msg.sentAt}:${msg.content}`)) continue;
        if (!msg.sentAt && next.some((m) => m.role === msg.role && m.content === msg.content)) continue;
        next.push(msg);
        if (msg.sentAt) seen.add(key);
      }
      return next;
    });
    const latest = incoming[incoming.length - 1];
    if (latest?.sentAt) setLastSeenAt(latest.sentAt);
  }, []);

  const pollMessages = useCallback(async () => {
    if (showNameStep || !config?.enabled) return;
    setSyncing(true);
    try {
      const sinceQuery = lastSeenAt ? `&since=${encodeURIComponent(lastSeenAt)}` : "";
      const res = await fetch(
        `${apiBase}/api/public/chat?sessionId=${encodeURIComponent(sessionId)}${sinceQuery}`,
      );
      const data = await res.json();
      if (!res.ok) return;
      setHumanHandling(Boolean(data.humanHandling));
      const incoming = Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
      mergeIncoming(incoming);
    } finally {
      setSyncing(false);
    }
  }, [apiBase, config?.enabled, lastSeenAt, mergeIncoming, sessionId, showNameStep]);

  useEffect(() => {
    if (!open || showNameStep || loading || !config?.enabled) return;
    const timer = setInterval(() => {
      void pollMessages();
    }, 3000);
    return () => clearInterval(timer);
  }, [open, showNameStep, loading, config?.enabled, pollMessages]);

  useEffect(() => {
    if (embed && !showNameStep && config?.enabled) {
      void pollMessages();
    }
  }, [embed, showNameStep, config?.enabled, pollMessages]);

  async function saveName() {
    const name = nameDraft.trim();
    if (name) {
      window.localStorage.setItem(NAME_KEY, name);
      setVisitorName(name);
      await fetch(`${apiBase}/api/public/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setName", sessionId, visitorName: name }),
      }).catch(() => undefined);
    }
    setShowNameStep(false);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || !config?.enabled || showNameStep) return;

    setInput("");
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch(`${apiBase}/api/public/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          visitorName: visitorName.trim() || undefined,
          pageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : copy.sendFailed);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, sentAt: data.sentAt }]);
      if (typeof data.sentAt === "string") setLastSeenAt(data.sentAt);
      if (data.handoff) setHumanHandling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.sendFailed);
    } finally {
      setSending(false);
    }
  }

  const accent = config?.primaryColor ?? "#3b82f6";
  const buttonLabel = config?.buttonLabel ?? (zh ? "在线咨询" : "Chat with us");

  if (embed) {
    return (
      <div className="flex h-dvh flex-col bg-slate-950 text-white">
        <header className="border-b border-slate-800 px-4 py-3" style={{ borderColor: `${accent}33` }}>
          <p className="font-semibold">{config?.title ?? "信号旗在线客服"}</p>
          {config?.subtitle && <p className="text-xs text-slate-400">{config.subtitle}</p>}
        </header>
        {renderBody()}
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[99999] font-sans">
      {open ? (
        <div className="mb-3 flex h-[min(560px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-white shadow-2xl">
          <header
            className="flex items-start justify-between gap-3 px-4 py-3"
            style={{ background: accent }}
          >
            <div>
              <p className="font-semibold">{config?.title ?? "信号旗在线客服"}</p>
              {config?.subtitle && <p className="text-xs text-white/85">{config.subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 hover:bg-white/10"
              aria-label={copy.close}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          {renderBody()}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-[1.02]"
        style={{ background: accent }}
      >
        <MessageCircle className="h-5 w-5" />
        {open ? copy.close : buttonLabel}
      </button>
    </div>
  );

  function renderBody() {
    if (loading) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          …
        </div>
      );
    }

    if (showNameStep) {
      return (
        <div className="flex flex-1 flex-col justify-center gap-3 px-4 py-6">
          <p className="text-sm text-slate-300">{config?.welcomeMessage}</p>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder={copy.namePlaceholder}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void saveName()}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white"
            style={{ background: accent }}
          >
            {copy.nameContinue}
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <div
                key={msg.sentAt ?? `${msg.role}-${i}-${msg.content.slice(0, 24)}`}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "ml-auto bg-white/10 text-white"
                    : "mr-auto border border-slate-800 bg-slate-900 text-slate-100"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.typing}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && <p className="px-4 pb-2 text-xs text-rose-400">{error}</p>}
          {humanHandling && (
            <p className="px-4 pb-2 text-xs text-amber-300">{copy.humanHandling}</p>
          )}
          {syncing && (
            <p className="px-4 pb-1 text-[10px] text-slate-500">{copy.liveRefresh}</p>
          )}
          {!config?.enabled && (
            <p className="px-4 pb-2 text-xs text-amber-400">{copy.disabled}</p>
          )}

          <div className="border-t border-slate-800 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                placeholder={copy.placeholder}
                disabled={!config?.enabled}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                disabled={sending || !input.trim() || !config?.enabled}
                onClick={() => void sendMessage()}
                className="rounded-xl p-2 text-white disabled:opacity-40"
                style={{ background: accent }}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-600">{copy.poweredBy}</p>
          </div>
        </div>
      </>
    );
  }
}
