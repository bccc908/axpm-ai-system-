"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, Send } from "lucide-react";
import { VoiceTextarea } from "@/components/ui/voice-field";
import { cn } from "@/lib/utils";
import type {
  FortuneFeedbackChatMessage,
  FortuneFeedbackChatSession,
  FortuneFeedbackRating,
  FortuneReading,
} from "@/types/fortune";

const RATINGS: FortuneFeedbackRating[] = ["accurate", "partial", "wrong"];

function formatReadingDateLabel(reading: FortuneReading, locale: "en" | "zh") {
  if (reading.fortune_date) {
    const d = new Date(`${reading.fortune_date}T12:00:00`);
    return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      month: "long",
      day: "numeric",
      weekday: locale === "zh" ? "long" : "short",
    });
  }
  const fromTitle = reading.title.split("·")[0]?.trim();
  return fromTitle || reading.title;
}

function formatDateKeyLabel(dateKey: string, locale: "en" | "zh") {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "long",
    day: "numeric",
  });
}

function buildWelcome(reading: FortuneReading, locale: "en" | "zh", t: (key: string, vars?: Record<string, string | number>) => string) {
  const date = formatReadingDateLabel(reading, locale);
  return t("fortune.feedbackChatWelcome", { date });
}

function isWelcomeMessage(m: FortuneFeedbackChatMessage, reading: FortuneReading, locale: "en" | "zh", t: (key: string, vars?: Record<string, string | number>) => string) {
  return m.role === "assistant" && m.content === buildWelcome(reading, locale, t);
}

export function FortuneReadingFeedback({
  reading,
  locale,
  t,
  todayKey,
  todayDailyReading,
  onSwitchToTodayReading,
}: {
  reading: FortuneReading;
  locale: "en" | "zh";
  t: (key: string, vars?: Record<string, string | number>) => string;
  todayKey: string;
  todayDailyReading: FortuneReading | null;
  onSwitchToTodayReading: () => void;
}) {
  const [messages, setMessages] = useState<FortuneFeedbackChatMessage[]>([]);
  const [draft, setDraft] = useState<FortuneFeedbackChatSession["draft"]>({
    rating: null,
    actual_outcome: null,
    errors: null,
    correction_notes: null,
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fbRes, chatRes] = await Promise.all([
        fetch(`/api/fortune/feedback?readingId=${encodeURIComponent(reading.id)}`),
        fetch(`/api/fortune/feedback/chat?readingId=${encodeURIComponent(reading.id)}`),
      ]);
      const fbData = await fbRes.json();
      const chatData = await chatRes.json();

      if (fbData.feedback) {
        setSaved(true);
        setDraft({
          rating: fbData.feedback.rating,
          actual_outcome: fbData.feedback.actual_outcome,
          errors: fbData.feedback.errors,
          correction_notes: fbData.feedback.correction_notes,
        });
        if (fbData.feedback.chat_messages?.length) {
          setMessages(fbData.feedback.chat_messages);
        }
      }

      if (chatData.session?.messages?.length) {
        setMessages(chatData.session.messages);
        setDraft(chatData.session.draft);
        setSaved(false);
      } else if (!fbData.feedback?.chat_messages?.length) {
        const kickRes = await fetch("/api/fortune/feedback/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reading_id: reading.id, kickoff: true, locale }),
        });
        const kickData = await kickRes.json();
        if (kickRes.ok && kickData.session) {
          setMessages(kickData.session.messages);
          setDraft(kickData.session.draft);
        } else {
          setMessage(kickData.error ?? t("fortune.feedbackChatFailed"));
        }
      }
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [locale, reading, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const body = (text ?? input).trim();
      if (!body || sending) return;

      setInput("");
      setSending(true);
      setMessage(null);

      const optimisticUser: FortuneFeedbackChatMessage = {
        role: "user",
        content: body,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);
      scrollToBottom();

      try {
        const res = await fetch("/api/fortune/feedback/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reading_id: reading.id,
            message: body,
            locale,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessages((prev) => prev.filter((m) => m !== optimisticUser));
          setInput(body);
          setMessage(data.error ?? t("fortune.feedbackChatFailed"));
          return;
        }

        if (data.session) {
          setMessages(data.session.messages);
          setDraft(data.session.draft);
        }
        setSaved(false);
        scrollToBottom();
      } catch {
        setMessages((prev) => prev.filter((m) => m !== optimisticUser));
        setInput(body);
        setMessage(t("fortune.feedbackChatFailed"));
      } finally {
        setSending(false);
      }
    },
    [input, locale, reading.id, sending, t],
  );

  async function handleSave() {
    if (!draft.rating) {
      setMessage(t("fortune.feedbackPickRating"));
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/fortune/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reading_id: reading.id,
          rating: draft.rating,
          actual_outcome: draft.actual_outcome,
          errors: draft.errors,
          correction_notes: draft.correction_notes,
          chat_messages: messages.filter((m) => !isWelcomeMessage(m, reading, locale, t)),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("fortune.feedbackFailed"));
        return;
      }
      setSaved(true);
      setMessage(t("fortune.feedbackSaved"));
    } catch {
      setMessage(t("fortune.feedbackFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-card-border bg-card/40 px-4 py-3 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("fortune.feedbackChatAuditing")}
      </div>
    );
  }

  const userTurns = messages.filter((m) => m.role === "user").length;
  const readingDateLabel = formatReadingDateLabel(reading, locale);
  const todayDateLabel = formatDateKeyLabel(todayKey, locale);
  const isTodayDaily =
    reading.topic === "daily" && reading.fortune_date === todayKey;
  const showWrongDayBanner = !isTodayDaily && todayDailyReading;

  return (
    <div className="mb-4 flex flex-col rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-4">
      <div className="mb-3 flex items-start gap-2">
        <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t("fortune.feedbackChatTitle")}</p>
          <p className="mt-0.5 text-xs font-medium text-accent">
            {t("fortune.feedbackChatForReading", { date: readingDateLabel })}
          </p>
          <p className="mt-0.5 text-xs text-muted">{t("fortune.feedbackChatDesc")}</p>
        </div>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("fortune.feedbackRecorded")}
          </span>
        ) : null}
      </div>

      {showWrongDayBanner ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {t("fortune.feedbackChatWrongDay", { date: readingDateLabel, today: todayDateLabel })}
          </p>
          <button
            type="button"
            onClick={onSwitchToTodayReading}
            className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-100"
          >
            {t("fortune.feedbackChatSwitchToday")}
          </button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="mb-3 max-h-[min(420px,50vh)] space-y-3 overflow-y-auto rounded-xl border border-card-border/60 bg-background/40 p-3"
      >
        {messages.map((msg, i) => (
          <div
            key={`${msg.created_at}-${i}`}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-accent/20 text-foreground rounded-br-md"
                  : "border border-card-border/80 bg-card/60 text-foreground rounded-bl-md",
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-card-border/80 bg-card/60 px-3 py-2 text-xs text-muted">
              <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              {t("fortune.feedbackChatTyping")}
            </div>
          </div>
        ) : null}
      </div>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <VoiceTextarea
          className="input-premium min-h-[52px] w-full resize-none rounded-xl px-3 py-2.5 text-sm"
          micPosition="bottom"
          value={input}
          onValueChange={setInput}
          onAfterVoiceTranscript={(text) => void sendMessage(text)}
          onSubmitEnter={() => void sendMessage()}
          enterKeyHint="send"
          placeholder={t("fortune.feedbackChatPlaceholder")}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40 sm:w-auto sm:min-w-[96px]"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("fortune.feedbackChatSend")}
        </button>
      </form>
      <p className="mt-1 text-[11px] text-muted">{t("fortune.feedbackChatHint")}</p>

      {userTurns > 0 && draft.rating ? (
        <div className="mt-3 border-t border-card-border/60 pt-3">
          <button
            type="button"
            onClick={() => setShowSummary((v) => !v)}
            className="text-xs text-accent hover:underline"
          >
            {showSummary ? t("fortune.feedbackHideSummary") : t("fortune.feedbackShowSummary")}
          </button>
          {showSummary ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                {RATINGS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, rating: item }))}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      draft.rating === item
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "border border-white/[0.08] text-muted",
                    )}
                  >
                    {t(`fortune.feedbackRating.${item}`)}
                  </button>
                ))}
              </div>
              {draft.errors ? (
                <p className="text-xs text-muted whitespace-pre-wrap">
                  <span className="text-foreground">{t("fortune.feedbackErrors")}：</span>
                  {draft.errors}
                </p>
              ) : null}
              {draft.correction_notes ? (
                <p className="text-xs text-muted whitespace-pre-wrap">
                  <span className="text-foreground">{t("fortune.feedbackCorrection")}：</span>
                  {draft.correction_notes}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {userTurns > 0 ? (
        <button
          type="button"
          disabled={saving || sending || !draft.rating}
          onClick={() => void handleSave()}
          className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm",
            draft.rating ? "btn-premium" : "border border-white/[0.12] text-muted",
            (saving || sending) && "opacity-50",
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          {saving ? t("fortune.feedbackSaving") : t("fortune.feedbackSave")}
        </button>
      ) : null}

      {message ? (
        <p
          className={cn(
            "mt-2 text-xs",
            message === t("fortune.feedbackSaved") ? "text-success" : "text-warning",
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
