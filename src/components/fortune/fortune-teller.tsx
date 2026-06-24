"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, ClipboardCheck, FileUp, History, Loader2, Sparkles, Trash2, User, Wand2 } from "lucide-react";
import { FortuneFeedbackHistory } from "@/components/fortune/fortune-feedback-history";
import { getFortuneDateLabel, getFortuneTodayKey } from "@/lib/fortune/date";
import { FortuneFaceCapture, type FaceImagePayload } from "@/components/fortune/fortune-face-capture";
import { FortuneReadingPanel } from "@/components/fortune/fortune-reading-panel";
import { FortuneTopicPicker } from "@/components/fortune/fortune-topic-picker";
import { FortuneZiweiChart } from "@/components/fortune/fortune-ziwei-chart";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceInput, VoiceTextarea } from "@/components/ui/voice-field";
import { formatDateLocalized } from "@/lib/i18n";
import type { FortuneProfile, FortuneReading, FortuneTopic } from "@/types/fortune";

type FortuneTab = "read" | "profile" | "history" | "reviews";

const ASK_EXAMPLES_ZH = [
  "这周适合签 ICCI 合作吗？",
  "六月财运与回款节奏如何？",
  "济南团队现在该不该加大投入？",
];

const ASK_EXAMPLES_EN = [
  "Should I sign the ICCI deal this week?",
  "How is my wealth luck in June?",
  "Should I invest more in the Jinan team now?",
];

const inputClass =
  "input-premium w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl btn-premium px-4 py-2.5 text-sm transition-colors disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/30 hover:text-foreground";

export function FortuneTeller() {
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<FortuneProfile>({
    name: null,
    birth_date: null,
    birth_time: null,
    notes: null,
  });
  const [readings, setReadings] = useState<FortuneReading[]>([]);
  const [topic, setTopic] = useState<FortuneTopic>("combined");
  const [askQuestion, setAskQuestion] = useState("");
  const [readingQuestion, setReadingQuestion] = useState("");
  const [faceImage, setFaceImage] = useState<FaceImagePayload | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [askMethod, setAskMethod] = useState<FortuneTopic>("combined");
  const [asking, setAsking] = useState(false);
  const [askTelegramMessage, setAskTelegramMessage] = useState<string | null>(null);
  const readingResultRef = useRef<HTMLDivElement>(null);
  const didAutoSelectToday = useRef(false);
  const [activeReading, setActiveReading] = useState<FortuneReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingSlow, setGeneratingSlow] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileZodiac, setProfileZodiac] = useState<string | null>(null);
  const [profileWesternSign, setProfileWesternSign] = useState<string | null>(null);
  const [profileLifePath, setProfileLifePath] = useState<number | null>(null);
  const [profileHourBranch, setProfileHourBranch] = useState<string | null>(null);
  const [profileBaziHour, setProfileBaziHour] = useState<string | null>(null);
  const [profileCurrentHour, setProfileCurrentHour] = useState<string | null>(null);
  const [profileChenggu, setProfileChenggu] = useState<string | null>(null);
  const [profileZiwei, setProfileZiwei] = useState<{
    wuxingJu: string;
    mingGong: string;
    mingStars: string[];
    shenGong: string;
    shenStars: string[];
    trait: string;
    lunarLabel: string;
    palaces: Array<{ branch: string; stars: string[] }>;
  } | null>(null);
  const [importMode, setImportMode] = useState<"share" | "file" | "paste">("share");
  const [shareUrl, setShareUrl] = useState(
    "https://chatgpt.com/share/6a290f01-0bb0-83ec-8949-dcca708fa8c0",
  );
  const [importPaste, setImportPaste] = useState("");
  const [importFilter, setImportFilter] = useState("");
  const [onlyFortune, setOnlyFortune] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    readings: number;
    conversations: number;
    shareTitle?: string;
    samples: Array<{ title: string; preview: string }>;
  } | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [questionTelegramEnabled, setQuestionTelegramEnabled] = useState(true);
  const [dailyLocale, setDailyLocale] = useState<"en" | "zh">("zh");
  const [lastDailySent, setLastDailySent] = useState<string | null>(null);
  const [telegramReady, setTelegramReady] = useState(false);
  const [savingDaily, setSavingDaily] = useState(false);
  const [sendingDaily, setSendingDaily] = useState(false);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [cachedMessage, setCachedMessage] = useState<string | null>(null);
  const [feedbackHint, setFeedbackHint] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<FortuneTopic | "all">("all");
  const [historySearch, setHistorySearch] = useState("");
  const [activeTab, setActiveTab] = useState<FortuneTab>("read");

  function applyProfileSystems(profileData: {
    profile?: FortuneProfile;
    zodiac?: string | null;
    systems?: {
      westernSign?: string | null;
      lifePath?: number | null;
      hourBranch?: string | null;
      baziHour?: string | null;
      currentHourBranch?: string | null;
      chenggu?: { totalLabel?: string } | null;
      ziwei?: {
        wuxingJu: string;
        mingGong: string;
        mingStars: string[];
        shenGong: string;
        shenStars: string[];
        trait: string;
        lunarLabel: string;
        palaces?: Array<{ branch: string; stars: string[] }>;
      } | null;
    };
  }) {
    if (profileData.profile) setProfile(profileData.profile);
    setProfileZodiac(profileData.zodiac ?? null);
    setProfileWesternSign(profileData.systems?.westernSign ?? null);
    setProfileLifePath(profileData.systems?.lifePath ?? null);
    setProfileHourBranch(profileData.systems?.hourBranch ?? null);
    setProfileBaziHour(profileData.systems?.baziHour ?? null);
    setProfileCurrentHour(profileData.systems?.currentHourBranch ?? null);
    setProfileChenggu(profileData.systems?.chenggu?.totalLabel ?? null);
    setProfileZiwei(
      profileData.systems?.ziwei
        ? {
            wuxingJu: profileData.systems.ziwei.wuxingJu,
            mingGong: profileData.systems.ziwei.mingGong,
            mingStars: profileData.systems.ziwei.mingStars,
            shenGong: profileData.systems.ziwei.shenGong,
            shenStars: profileData.systems.ziwei.shenStars,
            trait: profileData.systems.ziwei.trait,
            lunarLabel: profileData.systems.ziwei.lunarLabel,
            palaces: profileData.systems.ziwei.palaces ?? [],
          }
        : null,
    );
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, readingsRes, automationRes] = await Promise.all([
        fetch(`/api/fortune/profile?locale=${locale}`),
        fetch("/api/fortune/readings"),
        fetch("/api/fortune/automation"),
      ]);
      const [profileData, readingsData, automationData] = await Promise.all([
        profileRes.json(),
        readingsRes.json(),
        automationRes.json(),
      ]);
      setProfile(profileData.profile ?? {
        name: null,
        birth_date: null,
        birth_time: null,
        notes: null,
      });
      applyProfileSystems(profileData);
      setReadings(readingsData.readings ?? []);
      if (automationData.automation) {
        setDailyEnabled(automationData.automation.daily_telegram_enabled !== false);
        setQuestionTelegramEnabled(automationData.automation.question_telegram_enabled !== false);
        setDailyLocale(automationData.automation.daily_locale === "en" ? "en" : "zh");
        setLastDailySent(automationData.automation.last_daily_sent ?? null);
      }
      setTelegramReady(Boolean(automationData.telegram?.isReady));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const fromUrl = searchParams.get("topic");
    const allowed: FortuneTopic[] = [
      "daily",
      "career",
      "wealth",
      "love",
      "general",
      "astro",
      "tarot",
      "numerology",
      "ziwei",
      "meihua",
      "yijing",
      "chenggu",
      "mianxiang",
      "combined",
      "custom",
    ];
    if (fromUrl && allowed.includes(fromUrl as FortuneTopic)) {
      setTopic(fromUrl as FortuneTopic);
    }
  }, [searchParams]);

  useEffect(() => {
    if (topic === "mianxiang") return;
    setFaceImage((prev) => {
      if (prev?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, [topic]);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const res = await fetch(`/api/fortune/profile?locale=${locale}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data.profile) {
        applyProfileSystems(data);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      }
    } finally {
      setSavingProfile(false);
    }
  }

  const todayKey = getFortuneTodayKey();
  const todayDailyReading =
    readings.find((r) => r.topic === "daily" && r.fortune_date === todayKey) ?? null;
  const todayCombinedReading =
    readings.find(
      (r) => r.topic === "combined" && r.fortune_date === todayKey && !r.question?.trim(),
    ) ?? null;

  useEffect(() => {
    if (loading || didAutoSelectToday.current) return;
    const today = readings.find((r) => r.topic === "daily" && r.fortune_date === todayKey);
    if (today) {
      setActiveReading(today);
      didAutoSelectToday.current = true;
    }
  }, [loading, readings, todayKey]);

  const filteredReadings = readings.filter((r) => {
    if (historyFilter !== "all" && r.topic !== historyFilter) return false;
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      (r.question?.toLowerCase().includes(q) ?? false) ||
      (r.summary?.toLowerCase().includes(q) ?? false)
    );
  });

  function scrollToReading() {
    setActiveTab("read");
    window.setTimeout(() => {
      readingResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function telegramFeedback(data: {
    telegram?: { ok: boolean; sent?: boolean; skipped?: boolean; error?: string };
  }) {
    if (!data.telegram) return null;
    if (data.telegram.ok && data.telegram.sent) return t("fortune.questionTelegramSent");
    if (!data.telegram.ok) {
      return t("fortune.questionTelegramFailed", { error: data.telegram.error ?? "" });
    }
    return null;
  }

  async function submitFollowUpQuestion() {
    if (!askQuestion.trim() || !activeReading) return;
    setAsking(true);
    setAskTelegramMessage(null);
    setGeneratingSlow(false);
    const slowTimer = window.setTimeout(() => setGeneratingSlow(true), 2000);
    try {
      const res = await fetch("/api/fortune/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: askMethod,
          question: askQuestion.trim(),
          contextReadingId: activeReading.id,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "share_required") {
          setAskTelegramMessage(t("fortune.shareGateRequired"));
        }
        return;
      }
      if (data.reading) {
        setActiveReading(data.reading);
        setReadings((prev) => [data.reading, ...prev.filter((r) => r.id !== data.reading.id)]);
        setAskQuestion("");
        setAskTelegramMessage(telegramFeedback(data));
        scrollToReading();
      }
    } finally {
      window.clearTimeout(slowTimer);
      setGeneratingSlow(false);
      setAsking(false);
    }
  }

  async function generateReading(force = false) {
    if (topic === "mianxiang" && !faceImage) {
      setGenerateError(t("fortune.facePhotoNeedUpload"));
      return;
    }
    setGenerating(true);
    setGeneratingSlow(false);
    setCachedMessage(null);
    setFeedbackHint(null);
    setGenerateError(null);
    const slowTimer = window.setTimeout(() => setGeneratingSlow(true), 2000);
    try {
      const res = await fetch("/api/fortune/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          question: readingQuestion.trim() || null,
          locale,
          force,
          faceImage: topic === "mianxiang" && faceImage
            ? { data: faceImage.data, mimeType: faceImage.mimeType }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(typeof data.error === "string" ? data.error : t("fortune.generateFailed"));
        return;
      }
      if (data.reading) {
        setActiveReading(data.reading);
        setReadings((prev) => [data.reading, ...prev.filter((r) => r.id !== data.reading.id)]);
        if (data.cached) {
          setCachedMessage(t("fortune.cachedBadge"));
          window.setTimeout(() => setCachedMessage(null), 4000);
        } else if (data.feedbackCount > 0) {
          setFeedbackHint(t("fortune.feedbackUsedHint", { n: data.feedbackCount }));
        }
        scrollToReading();
      }
    } finally {
      window.clearTimeout(slowTimer);
      setGeneratingSlow(false);
      setGenerating(false);
    }
  }

  function viewTodayReading() {
    if (todayDailyReading) {
      setActiveReading(todayDailyReading);
      scrollToReading();
    }
  }

  function viewTodayCombined() {
    if (todayCombinedReading) {
      setActiveReading(todayCombinedReading);
      scrollToReading();
    }
  }

  async function deleteReading(id: string) {
    await fetch(`/api/fortune/readings/${id}`, { method: "DELETE" });
    setReadings((prev) => prev.filter((r) => r.id !== id));
    if (activeReading?.id === id) setActiveReading(null);
  }

  async function previewImport(file?: File) {
    const targetFile = file ?? selectedImportFile ?? undefined;
    setImporting(true);
    setImportMessage(null);
    setImportPreview(null);
    try {
      let res: Response;
      if (importMode === "share") {
        if (!shareUrl.trim()) return;
        res = await fetch("/api/fortune/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "share-url",
            shareUrl: shareUrl.trim(),
            preview: true,
          }),
        });
      } else if (importMode === "file") {
        if (!targetFile) return;
        setSelectedImportFile(targetFile);
        const form = new FormData();
        form.append("file", targetFile);
        form.append("mode", "chatgpt-json");
        form.append("preview", "true");
        form.append("onlyFortune", String(onlyFortune));
        if (importFilter.trim()) form.append("titleFilter", importFilter.trim());
        res = await fetch("/api/fortune/import", { method: "POST", body: form });
      } else {
        res = await fetch("/api/fortune/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "paste",
            text: importPaste,
            preview: true,
            title: t("fortune.importPasteTitle"),
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setImportPreview(data);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : t("fortune.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  async function runImport(file?: File) {
    const targetFile = file ?? selectedImportFile ?? undefined;
    setImporting(true);
    setImportMessage(null);
    try {
      let res: Response;
      if (importMode === "share") {
        if (!shareUrl.trim()) return;
        res = await fetch("/api/fortune/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "share-url",
            shareUrl: shareUrl.trim(),
            preview: false,
          }),
        });
      } else if (importMode === "file") {
        if (!targetFile) return;
        const form = new FormData();
        form.append("file", targetFile);
        form.append("mode", "chatgpt-json");
        form.append("preview", "false");
        form.append("onlyFortune", String(onlyFortune));
        if (importFilter.trim()) form.append("titleFilter", importFilter.trim());
        res = await fetch("/api/fortune/import", { method: "POST", body: form });
      } else {
        res = await fetch("/api/fortune/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "paste",
            text: importPaste,
            preview: false,
            title: t("fortune.importPasteTitle"),
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("fortune.importFailed"));
      setImportMessage(
        data.shareTitle
          ? t("fortune.importShareSuccess", {
              title: data.shareTitle,
              imported: data.imported ?? 0,
              skipped: data.skipped ?? 0,
            })
          : t("fortune.importSuccess", {
              imported: data.imported ?? 0,
              skipped: data.skipped ?? 0,
            }),
      );
      setImportPreview(null);
      setSelectedImportFile(null);
      await loadAll();
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : t("fortune.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  async function saveDailySettings() {
    setSavingDaily(true);
    setDailyMessage(null);
    try {
      const res = await fetch("/api/fortune/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_telegram_enabled: dailyEnabled,
          question_telegram_enabled: questionTelegramEnabled,
          daily_locale: dailyLocale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setLastDailySent(data.automation?.last_daily_sent ?? lastDailySent);
      setDailyMessage(t("fortune.dailySaved"));
    } catch (error) {
      setDailyMessage(error instanceof Error ? error.message : t("fortune.dailyFailed"));
    } finally {
      setSavingDaily(false);
    }
  }

  async function sendDailyNow(force = false) {
    setSendingDaily(true);
    setDailyMessage(null);
    try {
      const res = await fetch("/api/fortune/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.skipped && data.reason === "already_sent" && !force) {
        setDailyMessage(t("fortune.dailyAlreadySent"));
        return;
      }
      if (data.partial && data.telegram && !data.telegram.ok) {
        setDailyMessage(t("fortune.dailyPartial", { error: data.telegram.error ?? "" }));
        setLastDailySent(data.today ?? lastDailySent);
        await loadAll();
        return;
      }
      if (!data.ok && data.telegram && !data.telegram.ok) {
        throw new Error(data.telegram.error ?? t("fortune.dailyFailed"));
      }
      if (data.skipped && data.reason === "disabled") {
        setDailyMessage(t("fortune.dailyDisabled"));
        return;
      }
      if (data.ok && !data.skipped) {
        setDailyMessage(t("fortune.dailySent"));
        setLastDailySent(data.today ?? lastDailySent);
        await loadAll();
      }
    } catch (error) {
      setDailyMessage(error instanceof Error ? error.message : t("fortune.dailyFailed"));
    } finally {
      setSendingDaily(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        badge={t("fortune.badge")}
        icon={<Sparkles className="h-4 w-4 text-accent" />}
        title={t("fortune.title")}
        subtitle={t("fortune.subtitle")}
      />

      <nav className="glass-panel flex gap-1 rounded-2xl p-1">
        {(
          [
            { id: "read" as const, label: t("fortune.tabRead"), icon: Sparkles },
            { id: "profile" as const, label: t("fortune.tabProfile"), icon: User },
            { id: "history" as const, label: t("fortune.tabHistory"), icon: History },
            { id: "reviews" as const, label: t("fortune.tabReviews"), icon: ClipboardCheck },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              activeTab === id
                ? "btn-premium shadow-lg"
                : "text-muted hover:bg-white/[0.04] hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className={`space-y-6 ${activeTab !== "profile" ? "hidden" : ""}`}>
      <Card>
        <CardHeader title={t("fortune.profileTitle")} description={t("fortune.profileDesc")} />
        {profile.name || profile.birth_date ? (
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {profileZodiac ? (
                <Badge variant="default">
                  {t("fortune.zodiac")}: {profileZodiac}
                </Badge>
              ) : null}
              {profileWesternSign ? (
                <Badge variant="default">
                  {t("fortune.westernSign")}: {profileWesternSign}
                </Badge>
              ) : null}
              {profileLifePath ? (
                <Badge variant="muted">
                  {t("fortune.lifePath")}: {profileLifePath}
                </Badge>
              ) : null}
              {profileHourBranch ? (
                <Badge variant="muted">
                  {t("fortune.hourBranch")}: {profileHourBranch}
                  {profile.birth_time ? ` · ${profile.birth_time}` : ""}
                </Badge>
              ) : null}
              {profileBaziHour ? (
                <Badge variant="default">
                  {t("fortune.baziHour")}: {profileBaziHour}
                </Badge>
              ) : null}
              {profileChenggu ? (
                <Badge variant="muted">
                  {t("fortune.chengguWeight")}: {profileChenggu}
                </Badge>
              ) : null}
              {profile.birth_date ? (
                <Badge variant="muted">
                  {profile.birth_date}
                  {profile.birth_time ? ` · ${profile.birth_time}` : ""}
                </Badge>
              ) : null}
            </div>

            {profileZiwei ? (
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
                <p className="mb-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
                  {t("fortune.ziweiProfileTitle")}
                </p>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted">{t("fortune.ziweiJu")}：</span>
                    <span className="font-medium text-foreground">{profileZiwei.wuxingJu}</span>
                  </p>
                  <p>
                    <span className="text-muted">{t("fortune.ziweiLunar")}：</span>
                    <span className="text-foreground">{profileZiwei.lunarLabel}</span>
                  </p>
                  <p>
                    <span className="text-muted">{t("fortune.ziweiMing")}：</span>
                    <span className="font-medium text-foreground">
                      {profileZiwei.mingGong} · {profileZiwei.mingStars.join("、") || "—"}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted">{t("fortune.ziweiShen")}：</span>
                    <span className="text-foreground">
                      {profileZiwei.shenGong} · {profileZiwei.shenStars.join("、") || "—"}
                    </span>
                  </p>
                </div>
                {profileZiwei.palaces.length > 0 ? (
                  <div className="mt-3">
                    <FortuneZiweiChart
                      palaces={profileZiwei.palaces}
                      mingBranch={profileZiwei.mingGong.slice(-1)}
                      shenBranch={profileZiwei.shenGong.slice(-1)}
                      centerTitle={profileZiwei.wuxingJu}
                      centerSubtitle={profileZiwei.lunarLabel}
                      trait={profileZiwei.trait}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">{profileZiwei.trait}</p>
                )}
                {profileZiwei.lunarLabel.includes("近似") ? (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    {t("fortune.ziweiApproximate")}
                  </p>
                ) : null}
              </div>
            ) : profile.birth_date && !profile.birth_time ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t("fortune.ziweiNeedTime")}</p>
            ) : null}

            {profileCurrentHour ? (
              <Badge variant="muted">
                {t("fortune.currentHour")}: {profileCurrentHour}
              </Badge>
            ) : null}
          </div>
        ) : null}
        {!profile.birth_time ? (
          <p className="mb-4 text-xs text-amber-600 dark:text-amber-400">{t("fortune.birthTimeHint")}</p>
        ) : null}
        <p className="mb-4 text-xs text-muted">{t("fortune.profileFilledHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">{t("fortune.name")}</label>
            <VoiceInput
              className={inputClass}
              value={profile.name ?? ""}
              onValueChange={(value) => setProfile((p) => ({ ...p, name: value || null }))}
              placeholder={t("fortune.namePlaceholder")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">{t("fortune.birthDate")}</label>
            <input
              type="date"
              className={inputClass}
              value={profile.birth_date ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, birth_date: e.target.value || null }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">{t("fortune.birthTime")}</label>
            <input
              type="time"
              className={inputClass}
              value={profile.birth_time ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, birth_time: e.target.value || null }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">{t("fortune.notes")}</label>
            <VoiceTextarea
              className={`${inputClass} min-h-[140px] resize-y`}
              value={profile.notes ?? ""}
              onValueChange={(value) => setProfile((p) => ({ ...p, notes: value || null }))}
              placeholder={t("fortune.notesPlaceholder")}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className={btnPrimary} disabled={savingProfile} onClick={saveProfile}>
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("fortune.saveProfile")}
          </button>
          {profileSaved ? (
            <span className="text-xs text-success">{t("fortune.profileSaved")}</span>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t("fortune.dailyTitle")}
          description={t("fortune.dailyDesc")}
        />
        {!telegramReady ? (
          <p className="mb-3 text-sm text-muted">{t("fortune.dailyTelegramSetup")}</p>
        ) : null}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={dailyEnabled}
              onChange={(e) => setDailyEnabled(e.target.checked)}
            />
            {t("fortune.dailyEnabled")}
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={questionTelegramEnabled}
              onChange={(e) => setQuestionTelegramEnabled(e.target.checked)}
              disabled={!telegramReady}
            />
            {t("fortune.questionTelegramEnabled")}
          </label>
          <div>
            <label className="mb-1 block text-xs text-muted">{t("fortune.dailyLocale")}</label>
            <select
              className={inputClass}
              value={dailyLocale}
              onChange={(e) => setDailyLocale(e.target.value as "en" | "zh")}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
          {lastDailySent ? (
            <p className="text-xs text-muted">
              {t("fortune.dailyLastSent", { date: lastDailySent })}
            </p>
          ) : null}
          <p className="text-xs text-muted">{t("fortune.dailySchedule")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={savingDaily}
              onClick={saveDailySettings}
            >
              {savingDaily ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("fortune.dailySave")}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={sendingDaily || !telegramReady}
              onClick={() => sendDailyNow(true)}
            >
              {sendingDaily ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("fortune.dailySendNow")}
            </button>
          </div>
          {dailyMessage ? (
            <p className="text-sm text-foreground">{dailyMessage}</p>
          ) : null}
        </div>
      </Card>
      </div>

      <div className={`space-y-6 ${activeTab !== "read" ? "hidden" : ""}`}>
      <Card>
        <CardHeader
          title={t("fortune.readTitle")}
          description={
            topic === "daily"
              ? t("fortune.readDescDaily", { date: getFortuneDateLabel(locale) })
              : topic === "combined"
                ? t("fortune.readDescCombined")
                : t("fortune.readDesc")
          }
        />
        {topic === "daily" ? (
          <p className="mb-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-medium text-accent">
            📅 {getFortuneDateLabel(locale)}
          </p>
        ) : null}
        {topic === "combined" ? (
          <p className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-800 dark:text-violet-200">
            {t("fortune.combinedHint")}
          </p>
        ) : null}
        {topic === "mianxiang" ? (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            {t("fortune.mianxiangHint")}
          </p>
        ) : null}

        {topic === "mianxiang" ? (
          <FortuneFaceCapture
            value={faceImage}
            onChange={setFaceImage}
            onAnalyze={() => void generateReading(false)}
            analyzing={generating}
            t={t}
            disabled={generating}
          />
        ) : null}

        {generateError ? (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            {generateError}
          </p>
        ) : null}

        {topic === "mianxiang" && generatingSlow ? (
          <p className="mb-3 text-xs text-muted">{t("fortune.mianxiangAnalyzingSlow")}</p>
        ) : null}

        <FortuneTopicPicker topic={topic} onTopicChange={setTopic} locale={locale} t={t} />

        {topic === "daily" && todayDailyReading ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {t("fortune.todayReady")}
            </p>
            <button type="button" className={btnGhost} onClick={viewTodayReading}>
              {t("fortune.useTodayReading")}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={generating}
              onClick={() => generateReading(true)}
            >
              {t("fortune.regenerate")}
            </button>
          </div>
        ) : null}

        {topic === "combined" && todayCombinedReading && !readingQuestion.trim() ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2">
            <p className="text-sm text-violet-800 dark:text-violet-200">
              {t("fortune.combinedReady")}
            </p>
            <button type="button" className={btnGhost} onClick={viewTodayCombined}>
              {t("fortune.useCombinedReading")}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={generating}
              onClick={() => generateReading(true)}
            >
              {t("fortune.regenerate")}
            </button>
          </div>
        ) : null}

        {topic === "mianxiang" ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
              {t("fortune.mianxiangOptionalNotes")}
            </summary>
            <div className="mt-2">
              <VoiceTextarea
                className={`${inputClass} min-h-[72px] resize-y`}
                value={readingQuestion}
                onValueChange={setReadingQuestion}
                placeholder={t("fortune.mianxiangQuestionPlaceholder")}
                onSubmitEnter={() => {
                  if (!generating && faceImage) void generateReading(false);
                }}
              />
            </div>
          </details>
        ) : (
          <div className="mt-4">
            <label className="mb-1 block text-xs text-muted">
              {t("fortune.readingQuestionOptional")}
            </label>
            <VoiceTextarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={readingQuestion}
              onValueChange={setReadingQuestion}
              placeholder={t("fortune.readingQuestionPlaceholder")}
              onSubmitEnter={() => {
                if (!generating) void generateReading(false);
              }}
            />
            <p className="mt-1 text-xs text-muted">{t("fortune.readingQuestionHint")} · {t("fortune.enterToSubmit")}</p>
          </div>
        )}

        {topic !== "mianxiang" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={generating}
            onClick={() => generateReading(false)}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {generating ? t("fortune.generating") : t("fortune.generate")}
          </button>
          {cachedMessage ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{cachedMessage}</span>
          ) : null}
          {feedbackHint ? (
            <span className="text-xs font-medium text-accent">{feedbackHint}</span>
          ) : null}
        </div>
        ) : null}
        {topic !== "mianxiang" && generatingSlow ? (
          <p className="mt-2 text-xs text-muted">{t("fortune.generatingSlow")}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted">{t("fortune.disclaimer")}</p>
      </Card>

      {activeReading ? (
        <div ref={readingResultRef} className="scroll-mt-6">
          <FortuneReadingPanel
            reading={activeReading}
            locale={locale}
            t={t}
            todayKey={todayKey}
            todayDailyReading={todayDailyReading}
            onSwitchToTodayReading={viewTodayReading}
            askQuestion={askQuestion}
            onAskQuestionChange={setAskQuestion}
            askMethod={askMethod}
            onAskMethodChange={setAskMethod}
            asking={asking}
            generatingSlow={generatingSlow}
            onSubmitFollowUp={() => void submitFollowUpQuestion()}
            askExamples={locale === "zh" ? ASK_EXAMPLES_ZH : ASK_EXAMPLES_EN}
            questionTelegramEnabled={questionTelegramEnabled}
            telegramReady={telegramReady}
            askTelegramMessage={askTelegramMessage}
          />
        </div>
      ) : null}
      </div>

      <div className={`space-y-6 ${activeTab !== "profile" ? "hidden" : ""}`}>
      <Card>
        <CardHeader title={t("fortune.importTitle")} description={t("fortune.importDesc")} />
        <div className="space-y-4">
          <div className="rounded-lg border border-card-border bg-background/50 p-4 text-sm text-muted">
            <p className="font-medium text-foreground">{t("fortune.importStepsTitle")}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>{t("fortune.importStepShare")}</li>
              <li>{t("fortune.importStep1")}</li>
              <li>{t("fortune.importStep2")}</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setImportMode("share")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                importMode === "share"
                  ? "nav-pill-active rounded-full"
                  : "rounded-full border border-white/[0.08] text-muted hover:border-accent/30 hover:text-foreground"
              }`}
            >
              {t("fortune.importModeShare")}
            </button>
            <button
              type="button"
              onClick={() => setImportMode("file")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                importMode === "file"
                  ? "nav-pill-active rounded-full"
                  : "rounded-full border border-white/[0.08] text-muted hover:border-accent/30 hover:text-foreground"
              }`}
            >
              {t("fortune.importModeFile")}
            </button>
            <button
              type="button"
              onClick={() => setImportMode("paste")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                importMode === "paste"
                  ? "nav-pill-active rounded-full"
                  : "rounded-full border border-white/[0.08] text-muted hover:border-accent/30 hover:text-foreground"
              }`}
            >
              {t("fortune.importModePaste")}
            </button>
          </div>

          {importMode === "share" ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted">{t("fortune.importShareUrl")}</label>
                <input
                  className={inputClass}
                  value={shareUrl}
                  onChange={(e) => setShareUrl(e.target.value)}
                  placeholder="https://chatgpt.com/share/..."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  disabled={importing || !shareUrl.trim()}
                  onClick={() => previewImport()}
                >
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t("fortune.importPreview")}
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={importing || !shareUrl.trim()}
                  onClick={() => runImport()}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("fortune.importNow")}
                </button>
              </div>
              {importPreview ? (
                <div className="rounded-lg border border-card-border p-3 text-sm">
                  {importPreview.shareTitle ? (
                    <p className="font-medium text-foreground">{importPreview.shareTitle}</p>
                  ) : null}
                  <p className="mt-1 text-muted">
                    {t("fortune.importPreviewCount", {
                      readings: importPreview.readings,
                      conversations: importPreview.conversations,
                    })}
                  </p>
                  <ul className="mt-2 space-y-2 text-muted">
                    {importPreview.samples.map((sample, index) => (
                      <li key={`${sample.title}-${index}`}>
                        <span className="text-foreground">{sample.title}</span>
                        <span className="block text-xs">{sample.preview}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`${btnPrimary} mt-3`}
                    disabled={importing}
                    onClick={() => runImport()}
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t("fortune.importConfirm")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : importMode === "file" ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted">{t("fortune.importFilter")}</label>
                <input
                  className={inputClass}
                  value={importFilter}
                  onChange={(e) => setImportFilter(e.target.value)}
                  placeholder={t("fortune.importFilterPlaceholder")}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={onlyFortune}
                  onChange={(e) => setOnlyFortune(e.target.checked)}
                />
                {t("fortune.importOnlyFortune")}
              </label>
              <label className={`${btnGhost} cursor-pointer`}>
                <FileUp className="h-3.5 w-3.5" />
                {selectedImportFile?.name ?? t("fortune.importChooseFile")}
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setSelectedImportFile(file);
                    await previewImport(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {importPreview ? (
                <div className="rounded-lg border border-card-border p-3 text-sm">
                  <p className="font-medium text-foreground">
                    {t("fortune.importPreviewCount", {
                      readings: importPreview.readings,
                      conversations: importPreview.conversations,
                    })}
                  </p>
                  <ul className="mt-2 space-y-2 text-muted">
                    {importPreview.samples.map((sample, index) => (
                      <li key={`${sample.title}-${index}`}>
                        <span className="text-foreground">{sample.title}</span>
                        <span className="block text-xs">{sample.preview}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`${btnPrimary} mt-3`}
                    disabled={importing || !selectedImportFile}
                    onClick={() => runImport()}
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t("fortune.importConfirm")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <VoiceTextarea
                className={`${inputClass} min-h-[160px] resize-y`}
                value={importPaste}
                onValueChange={setImportPaste}
                placeholder={t("fortune.importPastePlaceholder")}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnGhost}
                  disabled={importing || importPaste.trim().length < 20}
                  onClick={() => previewImport()}
                >
                  {t("fortune.importPreview")}
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={importing || importPaste.trim().length < 20}
                  onClick={() => runImport()}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("fortune.importNow")}
                </button>
              </div>
              {importPreview ? (
                <p className="text-sm text-muted">
                  {t("fortune.importPreviewCount", {
                    readings: importPreview.readings,
                    conversations: importPreview.conversations,
                  })}
                </p>
              ) : null}
            </div>
          )}

          {importMessage ? (
            <p className="rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground">
              {importMessage}
            </p>
          ) : null}
        </div>
      </Card>
      </div>

      <div className={`space-y-6 ${activeTab !== "history" ? "hidden" : ""}`}>
      <Card>
        <CardHeader title={t("fortune.historyTitle")} description={t("fortune.historyDesc")} />
        {readings.length === 0 ? (
          <p className="text-sm text-muted">{t("fortune.noHistory")}</p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                className={inputClass}
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={t("fortune.historySearch")}
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    historyFilter === "all"
                      ? "nav-pill-active rounded-full"
                      : "rounded-full border border-white/[0.08] text-muted"
                  }`}
                  onClick={() => setHistoryFilter("all")}
                >
                  {t("fortune.historyFilterAll")}
                </button>
                {(["combined", "daily", "custom", "ziwei", "mianxiang"] as FortuneTopic[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      historyFilter === item
                        ? "nav-pill-active rounded-full"
                        : "rounded-full border border-white/[0.08] text-muted"
                    }`}
                    onClick={() => setHistoryFilter(item)}
                  >
                    {t(`fortune.topics.${item}`)}
                  </button>
                ))}
              </div>
            </div>
            <ul className="divide-y divide-card-border">
              {filteredReadings.length === 0 ? (
                <li className="py-3 text-sm text-muted">{t("fortune.historyNoMatch")}</li>
              ) : (
                filteredReadings.map((reading) => (
                  <li key={reading.id} className="flex items-start justify-between gap-3 py-3">
                    <button
                      type="button"
                      className={`min-w-0 flex-1 rounded-lg text-left transition-colors ${
                        activeReading?.id === reading.id ? "bg-accent/10 px-2 py-1" : ""
                      }`}
                      onClick={() => {
                        setActiveReading(reading);
                        scrollToReading();
                      }}
                    >
                      <p className="truncate text-sm font-medium text-foreground">{reading.title}</p>
                      {reading.question ? (
                        <p className="mt-0.5 truncate text-xs text-accent">{reading.question}</p>
                      ) : null}
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Calendar className="h-3 w-3" />
                        {reading.fortune_date
                          ? reading.fortune_date
                          : formatDateLocalized(reading.created_at, locale)}
                        <Badge variant="muted">{t(`fortune.topics.${reading.topic}`)}</Badge>
                      </p>
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => deleteReading(reading.id)}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </Card>
      </div>

      <div className={`space-y-6 ${activeTab !== "reviews" ? "hidden" : ""}`}>
        <Card>
          <CardHeader
            title={t("fortune.feedbackHistoryTitle")}
            description={t("fortune.feedbackHistoryDesc")}
          />
          <FortuneFeedbackHistory locale={locale} t={t} />
        </Card>
      </div>
    </div>
  );
}
