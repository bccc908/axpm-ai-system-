"use client";

import { useEffect, useState } from "react";
import { Compass, Loader2, MessageCircle, Sparkles, Star } from "lucide-react";
import { FortuneReadingBody } from "@/components/fortune/fortune-reading-body";
import { FortuneReadingFeedback } from "@/components/fortune/fortune-reading-feedback";
import { FortuneShareGate } from "@/components/fortune/fortune-share-gate";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VoiceTextarea } from "@/components/ui/voice-field";
import { formatDateLocalized } from "@/lib/i18n";
import type { FortuneReading, FortuneTopic } from "@/types/fortune";

const ASK_METHODS: FortuneTopic[] = [
  "combined",
  "meihua",
  "yijing",
  "ziwei",
  "tarot",
  "chenggu",
  "mianxiang",
  "astro",
  "numerology",
  "custom",
];

const inputClass =
  "input-premium w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl btn-premium px-4 py-2.5 text-sm transition-colors disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/30 hover:text-foreground";

function LuckyChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-background px-3 py-2.5">
      <p className="flex items-center gap-1 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function FortuneReadingPanel({
  reading,
  locale,
  t,
  todayKey,
  todayDailyReading,
  onSwitchToTodayReading,
  askQuestion,
  onAskQuestionChange,
  askMethod,
  onAskMethodChange,
  asking,
  generatingSlow,
  onSubmitFollowUp,
  askExamples,
  questionTelegramEnabled,
  telegramReady,
  askTelegramMessage,
}: {
  reading: FortuneReading;
  locale: "en" | "zh";
  t: (key: string, vars?: Record<string, string | number>) => string;
  todayKey: string;
  todayDailyReading: FortuneReading | null;
  onSwitchToTodayReading: () => void;
  askQuestion: string;
  onAskQuestionChange: (value: string) => void;
  askMethod: FortuneTopic;
  onAskMethodChange: (method: FortuneTopic) => void;
  asking: boolean;
  generatingSlow: boolean;
  onSubmitFollowUp: () => void;
  askExamples: string[];
  questionTelegramEnabled: boolean;
  telegramReady: boolean;
  askTelegramMessage: string | null;
}) {
  const [followUpUnlocked, setFollowUpUnlocked] = useState(false);
  const canAskFollowUp = followUpUnlocked;

  useEffect(() => {
    setFollowUpUnlocked(false);
  }, [reading.id]);

  const mottoMatch = reading.reading.match(/(?:今日箴言|今日关键词|关键词)[：:]\s*(.+)/);
  const motto = mottoMatch?.[1]?.replace(/\*\*/g, "").trim();
  const isShortMianxiang =
    reading.topic === "mianxiang" && reading.reading.replace(/\s/g, "").length < 120;

  return (
    <Card className="overflow-hidden border-accent/25 bg-gradient-to-b from-accent/[0.08] to-transparent shadow-[0_0_48px_-16px_var(--accent-glow)]">
      <CardHeader
        title={reading.title}
        description={
          reading.summary ??
          (reading.fortune_date ? reading.fortune_date : formatDateLocalized(reading.created_at, locale))
        }
        action={<Badge variant="default">{t(`fortune.topics.${reading.topic}`)}</Badge>}
      />

      {reading.question ? (
        <p className="mb-3 rounded-xl border border-accent/25 bg-background/80 px-3 py-2.5 text-sm text-foreground">
          <span className="font-medium text-accent">{t("fortune.askQuestionLabel")}：</span>
          {reading.question}
        </p>
      ) : null}

      {reading.zodiac ? (
        <p className="mb-3 text-sm text-accent">
          {t("fortune.zodiac")}: {reading.zodiac}
        </p>
      ) : null}

      {reading.topic === "mianxiang" ? (
        <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs text-muted">
          <p className="font-semibold text-foreground">{t("fortune.mianxiangWhatWeReadTitle")}</p>
          <p className="mt-1 leading-relaxed">{t("fortune.mianxiangWhatWeReadBody")}</p>
        </div>
      ) : null}

      {isShortMianxiang ? (
        <div className="mb-4 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-800 dark:text-rose-200">
          {t("fortune.mianxiangShortResultWarning")}
        </div>
      ) : null}

      {motto ? (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            {t("fortune.mottoLabel")}
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">{motto}</p>
        </div>
      ) : null}

      <FortuneReadingBody text={reading.reading} />

      <div className="mt-6 border-t border-accent/20 pt-5">
        <FortuneReadingFeedback
          reading={reading}
          locale={locale}
          t={t}
          todayKey={todayKey}
          todayDailyReading={todayDailyReading}
          onSwitchToTodayReading={onSwitchToTodayReading}
        />
      </div>

      <div className="mt-4 border-t border-accent/20 pt-5">
        <FortuneShareGate
          readingId={reading.id}
          locale={locale}
          t={t}
          onUnlocked={() => setFollowUpUnlocked(true)}
        />
      </div>

      {reading.lucky ? (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {reading.lucky.color ? (
            <LuckyChip
              icon={<Star className="h-3.5 w-3.5" />}
              label={t("fortune.luckyColor")}
              value={reading.lucky.color}
            />
          ) : null}
          {reading.lucky.number ? (
            <LuckyChip
              icon={<Compass className="h-3.5 w-3.5" />}
              label={t("fortune.luckyNumber")}
              value={reading.lucky.number}
            />
          ) : null}
          {reading.lucky.direction ? (
            <LuckyChip
              icon={<Compass className="h-3.5 w-3.5" />}
              label={t("fortune.luckyDirection")}
              value={reading.lucky.direction}
            />
          ) : null}
          {reading.lucky.keyword ? (
            <LuckyChip
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label={t("fortune.luckyKeyword")}
              value={reading.lucky.keyword}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-accent/15 bg-background/50 p-4">
        <p className="mb-1 text-sm font-medium text-foreground">{t("fortune.askAfterReadingTitle")}</p>
        <p className="mb-3 text-xs text-muted">{t("fortune.askAfterReadingDesc")}</p>

        <VoiceTextarea
          className={`${inputClass} min-h-[88px] resize-y ${!canAskFollowUp ? "opacity-50" : ""}`}
          value={askQuestion}
          onValueChange={onAskQuestionChange}
          placeholder={
            canAskFollowUp
              ? t("fortune.askAfterReadingPlaceholder")
              : t("fortune.shareGateLockedPlaceholder")
          }
          disabled={!canAskFollowUp}
          onSubmitEnter={() => {
            if (canAskFollowUp && !asking && askQuestion.trim()) onSubmitFollowUp();
          }}
        />
        <p className="mt-1 text-xs text-muted">{t("fortune.enterToSubmit")}</p>
        <p className="mb-2 mt-3 text-xs text-muted">{t("fortune.askMethodLabel")}</p>
        <div className={`mb-3 flex flex-wrap gap-2 ${!canAskFollowUp ? "pointer-events-none opacity-50" : ""}`}>
          {ASK_METHODS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onAskMethodChange(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                askMethod === item
                  ? "nav-pill-active"
                  : "border border-white/[0.08] text-muted hover:border-accent/30 hover:text-foreground"
              }`}
            >
              {t(`fortune.topics.${item}`)}
            </button>
          ))}
        </div>
        <div className={`mb-3 flex flex-wrap gap-2 ${!canAskFollowUp ? "pointer-events-none opacity-50" : ""}`}>
          {askExamples.map((example) => (
            <button key={example} type="button" className={btnGhost} onClick={() => onAskQuestionChange(example)}>
              {example}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={btnPrimary}
          disabled={asking || !askQuestion.trim() || !canAskFollowUp}
          onClick={onSubmitFollowUp}
        >
          {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          {asking ? t("fortune.askGenerating") : t("fortune.askAfterReadingSubmit")}
        </button>
        {asking && generatingSlow ? (
          <p className="mt-2 text-xs text-muted">{t("fortune.generatingSlow")}</p>
        ) : null}
        {questionTelegramEnabled && telegramReady ? (
          <p className="mt-2 text-xs text-muted">{t("fortune.questionTelegramHint")}</p>
        ) : null}
        {askTelegramMessage ? <p className="mt-2 text-sm text-foreground">{askTelegramMessage}</p> : null}
      </div>
    </Card>
  );
}
