"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Download,
  Film,
  ImageIcon,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VoiceTextarea } from "@/components/ui/voice-field";
import { formatDateLocalized } from "@/lib/i18n";
import type { SocialIntegrationStatus, SocialPlatform, SocialPost } from "@/types/social";
import { MARKETING_PROMPT_TEMPLATE } from "@/lib/social/marketing-prompt-template";

type SpeechSource = "piper" | "minimax" | "edge" | "mac" | "silent";
type TtsPriority = "piper" | "minimax" | "edge" | "mac" | "auto";
type VoiceOption = { id: string; labelZh: string; labelEn: string };

type SlideCard = { tag: string; headline: string; body: string };

function voiceLabel(v: VoiceOption, loc: string) {
  return loc === "zh" ? v.labelZh : v.labelEn;
}

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted transition-colors disabled:opacity-50";

const ALL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "wechat_oa",
  "xiaohongshu",
  "tiktok",
  "weibo",
  "douyin",
];

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  draft: "muted",
  scheduled: "warning",
  published: "success",
  failed: "danger",
};

export function SocialDashboard() {
  const { t, locale } = useLocale();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [integrations, setIntegrations] = useState<SocialIntegrationStatus | null>(null);
  const [cronUrl, setCronUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publishCaption, setPublishCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [copyStyle, setCopyStyle] = useState<"viral" | "pro" | "story">("viral");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["douyin"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaPack, setMediaPack] = useState<{
    slides: { name: string; url: string }[];
    video?: { name: string; url: string };
  } | null>(null);
  const [slideCards, setSlideCards] = useState<SlideCard[]>([]);
  const [narrationsZh, setNarrationsZh] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [videoMode, setVideoMode] = useState<"presenter" | "slides">("presenter");
  const [marketingPrompt, setMarketingPrompt] = useState("");
  const [marketingSaving, setMarketingSaving] = useState(false);
  const [marketingLoaded, setMarketingLoaded] = useState(false);
  const [marketingSaveHint, setMarketingSaveHint] = useState<string | null>(null);
  const [edgeVoice, setEdgeVoice] = useState("zh-CN-YunxiNeural");
  const [macVoice, setMacVoice] = useState("Meijia");
  const [ttsPriority, setTtsPriority] = useState<TtsPriority>("auto");
  const [edgeVoiceOptions, setEdgeVoiceOptions] = useState<VoiceOption[]>([]);
  const [macVoiceOptions, setMacVoiceOptions] = useState<VoiceOption[]>([]);
  const [presenterSettingsSaving, setPresenterSettingsSaving] = useState(false);
  const [presenterSettingsHint, setPresenterSettingsHint] = useState<string | null>(null);
  const [lastSpeechSource, setLastSpeechSource] = useState<SpeechSource | null>(null);
  const [videoCacheBust, setVideoCacheBust] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/social/posts");
      const data = await res.json();
      setPosts(data.posts ?? []);
      setIntegrations(data.integrations ?? null);
      setCronUrl(data.cronUrl ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/social/media/avatar")
      .then((r) => r.json())
      .then((d) => {
        if (d.hasPhoto && d.url) {
          setAvatarUrl(d.url);
          setVideoMode("presenter");
        }
      })
      .catch(() => undefined);
    fetch("/api/social/marketing-prompt", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "load failed");
        if (typeof d.prompt === "string") setMarketingPrompt(d.prompt);
      })
      .catch(() => setMarketingSaveHint(t("social.marketingPromptLoadFailed")))
      .finally(() => setMarketingLoaded(true));
    fetch("/api/social/presenter-settings", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) return;
        if (typeof d.edgeVoice === "string") setEdgeVoice(d.edgeVoice);
        if (typeof d.macVoice === "string") setMacVoice(d.macVoice);
        if (
          d.ttsPriority === "piper" ||
          d.ttsPriority === "minimax" ||
          d.ttsPriority === "edge" ||
          d.ttsPriority === "mac" ||
          d.ttsPriority === "auto"
        ) {
          setTtsPriority(d.ttsPriority);
        }
        if (Array.isArray(d.edgeVoices)) setEdgeVoiceOptions(d.edgeVoices);
        if (Array.isArray(d.macVoices)) setMacVoiceOptions(d.macVoices);
      })
      .catch(() => undefined);
  }, [load, t]);

  function formatSaveError(error: unknown): string {
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "fieldErrors" in error) {
      const fe = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      const first = fe?.prompt?.[0];
      if (first) return first;
    }
    return t("social.marketingPromptFailed");
  }

  async function saveMarketingPrompt() {
    setMarketingSaving(true);
    setMarketingSaveHint(null);
    try {
      const res = await fetch("/api/social/marketing-prompt", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: marketingPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMarketingSaveHint(formatSaveError(data.error));
        return;
      }
      setMarketingPrompt(typeof data.prompt === "string" ? data.prompt : marketingPrompt);
      setMarketingSaveHint(t("social.marketingPromptSaved"));
    } catch {
      setMarketingSaveHint(t("social.marketingPromptFailed"));
    } finally {
      setMarketingSaving(false);
    }
  }

  async function savePresenterSettings() {
    setPresenterSettingsSaving(true);
    setPresenterSettingsHint(null);
    try {
      const res = await fetch("/api/social/presenter-settings", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edgeVoice, macVoice, ttsPriority }),
      });
      if (!res.ok) {
        setPresenterSettingsHint(t("social.presenterSettingsFailed"));
        return;
      }
      setPresenterSettingsHint(t("social.presenterSettingsSaved"));
    } catch {
      setPresenterSettingsHint(t("social.presenterSettingsFailed"));
    } finally {
      setPresenterSettingsSaving(false);
    }
  }

  function speechSourceLabel(source: SpeechSource | null | undefined) {
    if (source === "piper") return t("social.speechSourcePiper");
    if (source === "minimax") return t("social.speechSourceMiniMax");
    if (source === "edge") return t("social.speechSourceEdge");
    if (source === "mac") return t("social.speechSourceMac");
    if (source === "silent") return t("social.speechSourceSilent");
    return null;
  }

  async function uploadPresenterPhoto(file: File) {
    setAvatarUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/social/media/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("social.avatarFailed"));
        return;
      }
      setAvatarUrl(data.url);
      setVideoMode("presenter");
      setMessage(t("social.avatarReady"));
    } finally {
      setAvatarUploading(false);
    }
  }

  function togglePlatform(p: SocialPlatform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function generateMedia(auto = false) {
    if (!title.trim() || !content.trim()) {
      if (!auto) setMessage(t("social.mediaNeedDraft"));
      return;
    }
    setMediaLoading(true);
    if (!auto) setMessage(null);
    try {
      const res = await fetch("/api/social/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          script: content.trim(),
          slideCards: slideCards.length ? slideCards : undefined,
          narrationsZh: narrationsZh.length ? narrationsZh : undefined,
          video: true,
          mode: videoMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("social.mediaFailed"));
        return;
      }
      setMediaPack({ slides: data.slides ?? [], video: data.video });
      if (data.slides?.[0]?.url) {
        setImageUrl(`${window.location.origin}${data.slides[0].url}`);
      }
      if (
        data.speechSource === "piper" ||
        data.speechSource === "minimax" ||
        data.speechSource === "edge" ||
        data.speechSource === "mac" ||
        data.speechSource === "silent"
      ) {
        setLastSpeechSource(data.speechSource);
      }
      setVideoCacheBust(Date.now());
      setMessage(
        data.videoWarning ??
          (data.video
            ? data.mode === "presenter" && data.speechSource === "silent"
              ? t("social.presenterSilentReady")
              : data.mode === "presenter"
                ? t("social.presenterReady")
                : t("social.mediaReady")
            : t("social.slidesReady")),
      );
    } finally {
      setMediaLoading(false);
    }
  }

  async function generateDraft() {
    if (!topic.trim()) return;
    setDrafting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/social/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          locale,
          style: copyStyle,
          platform: platforms.includes("xiaohongshu")
            ? "xiaohongshu"
            : platforms.includes("douyin")
              ? "douyin"
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("social.draftFailed"));
        return;
      }
      setTitle(data.title ?? topic);
      const script =
        typeof data.script_zh === "string"
          ? data.script_zh
          : (data.content_zh ?? data.content ?? "");
      const caption =
        typeof data.content_zh === "string" && data.content_zh !== script
          ? data.content_zh
          : "";

      if (platforms.includes("douyin")) {
        setContent(locale === "zh" ? script : (data.content_en ?? script));
        setPublishCaption(locale === "zh" ? caption : "");
      } else {
        setContent(
          locale === "zh"
            ? (data.content_zh ?? data.content ?? script)
            : (data.content_en ?? data.content ?? ""),
        );
        setPublishCaption("");
      }

      if (Array.isArray(data.slides_zh)) {
        setSlideCards(
          data.slides_zh.filter(
            (c: SlideCard) => c?.headline && typeof c.headline === "string",
          ),
        );
      }
      if (Array.isArray(data.narrations_zh)) {
        setNarrationsZh(
          data.narrations_zh.filter((n: unknown) => typeof n === "string" && n.trim()),
        );
      }

      const needsMedia =
        platforms.includes("douyin") || platforms.includes("xiaohongshu");
      if (needsMedia && script.trim()) {
        void generateMediaPack(
          data.title ?? topic,
          script,
          data.slides_zh,
          data.narrations_zh,
        );
      } else {
        setMessage(t("social.draftReady"));
      }
    } finally {
      setDrafting(false);
    }
  }

  async function generateMediaPack(
    draftTitle: string,
    draftScript: string,
    cards?: SlideCard[],
    narrations?: string[],
  ) {
    setMediaLoading(true);
    setMediaPack(null);
    try {
      const res = await fetch("/api/social/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim(),
          script: draftScript.trim(),
          slideCards: (cards ?? slideCards).length ? (cards ?? slideCards) : undefined,
          narrationsZh: (narrations ?? narrationsZh).length
            ? (narrations ?? narrationsZh)
            : undefined,
          video: true,
          mode: videoMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("social.mediaFailed"));
        return;
      }
      setMediaPack({ slides: data.slides ?? [], video: data.video });
      if (data.slides?.[0]?.url) {
        setImageUrl(`${window.location.origin}${data.slides[0].url}`);
      }
      if (
        data.speechSource === "piper" ||
        data.speechSource === "minimax" ||
        data.speechSource === "edge" ||
        data.speechSource === "mac" ||
        data.speechSource === "silent"
      ) {
        setLastSpeechSource(data.speechSource);
      }
      setVideoCacheBust(Date.now());
      setMessage(
        data.videoWarning ??
          (data.mode === "presenter"
            ? data.speechSource === "silent"
              ? t("social.presenterSilentReady")
              : t("social.presenterReady")
            : data.video
              ? t("social.mediaReady")
              : t("social.slidesReady")),
      );
    } finally {
      setMediaLoading(false);
    }
  }

  async function savePost(publishNow: boolean) {
    if (!title.trim() || !content.trim() || platforms.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          image_url: imageUrl.trim() || null,
          platforms,
          locale,
          scheduled_at: publishNow ? null : scheduledAt || null,
          publish_now: publishNow,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(publishNow ? t("social.published") : t("social.saved"));
        if (!publishNow && !scheduledAt) {
          setTitle("");
          setContent("");
          setImageUrl("");
        }
        load();
      } else {
        setMessage(data.error ?? t("social.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(id: string) {
    await fetch(`/api/social/posts/${id}`, { method: "DELETE" });
    load();
  }

  async function copyForDouyin() {
    if (!title.trim() && !content.trim()) return;
    const res = await fetch("/api/douyin/format", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content: publishCaption.trim() || content.trim(),
        script: content.trim(),
      }),
    });
    const data = await res.json();
    if (data.copyText) {
      await navigator.clipboard.writeText(data.copyText);
      setMessage(t("social.douyinCopied"));
    }
  }

  async function copyForXhs() {
    if (!title.trim() && !content.trim()) return;
    const res = await fetch("/api/xiaohongshu/format", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    const data = await res.json();
    if (data.copyText) {
      await navigator.clipboard.writeText(data.copyText);
      setMessage(t("social.xhsCopied"));
    }
  }

  async function publishExisting(id: string) {
    setSaving(true);
    try {
      await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: id }),
      });
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("social.title")}</h1>
        <p className="mt-1 text-muted">{t("social.subtitle")}</p>
      </div>

      {integrations && (
        <Card>
          <CardHeader title={t("social.connections")} description={t("social.connectionsDesc")} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_PLATFORMS.map((p) => {
              const status = integrations[p];
              return (
                <div key={p} className="flex items-center justify-between rounded-lg border border-card-border px-3 py-2 text-sm">
                  <span>{t(`social.platforms.${p}`)}</span>
                  {status.ready ? (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-4 w-4" /> {t("settings.connected")}
                    </span>
                  ) : status.configured ? (
                    <span className="text-warning">{t("social.partial")}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted">
                      <XCircle className="h-4 w-4" /> {t("settings.notConfigured")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("social.marketingPromptTitle")}
            description={t("social.marketingPromptDesc")}
          />
          <div className="space-y-3">
            <textarea
              className={`${inputClass} min-h-[140px] resize-y leading-relaxed`}
              placeholder={t("social.marketingPromptPlaceholder")}
              value={marketingPrompt}
              onChange={(e) => setMarketingPrompt(e.target.value)}
              disabled={!marketingLoaded}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
                disabled={!marketingLoaded}
                onClick={() => {
                  if (!marketingPrompt.trim()) setMarketingPrompt(MARKETING_PROMPT_TEMPLATE);
                  else setMarketingPrompt(`${marketingPrompt.trim()}\n\n${MARKETING_PROMPT_TEMPLATE}`);
                }}
              >
                {t("social.marketingPromptInsertTemplate")}
              </button>
            </div>
            <button
              type="button"
              className={btnPrimary}
              disabled={marketingSaving || !marketingLoaded}
              onClick={() => void saveMarketingPrompt()}
            >
              {marketingSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {t("social.marketingPromptSave")}
            </button>
            {marketingSaveHint ? (
              <p
                className={`text-xs ${
                  marketingSaveHint === t("social.marketingPromptSaved")
                    ? "text-success"
                    : "text-danger"
                }`}
              >
                {marketingSaveHint}
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title={t("social.compose")} description={t("social.composeDesc")} />
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">{t("social.selectPlatforms")}</p>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      platforms.includes(p)
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-card-border text-muted"
                    }`}
                  >
                    {t(`social.platforms.${p}`)}
                  </button>
                ))}
              </div>
              {(platforms.includes("douyin") || platforms.includes("xiaohongshu")) && (
                <div className="mt-3 rounded-lg border border-card-border bg-background/60 p-3 space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <User className="h-4 w-4 text-accent" />
                    {t("social.avatarTitle")}
                  </p>
                  <p className="text-xs text-muted">{t("social.avatarDesc")}</p>
                  <p className="text-xs text-accent/90">{t("social.avatarTips")}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt="You"
                        className="h-20 w-20 rounded-full border-2 border-accent object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-card-border text-xs text-muted">
                        {t("social.avatarEmpty")}
                      </div>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-accent/40 px-3 py-2 text-xs text-accent hover:bg-accent/10">
                      {avatarUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {avatarUrl ? t("social.avatarReplace") : t("social.avatarUpload")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={avatarUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadPresenterPhoto(f);
                        }}
                      />
                    </label>
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-muted">{t("social.videoModeLabel")}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!avatarUrl}
                        onClick={() => setVideoMode("presenter")}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          videoMode === "presenter"
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-card-border text-muted"
                        } disabled:opacity-40`}
                      >
                        {t("social.videoModePresenter")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoMode("slides")}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          videoMode === "slides"
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-card-border text-muted"
                        }`}
                      >
                        {t("social.videoModeSlides")}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-card-border/80 bg-background/40 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">{t("social.presenterVoiceTitle")}</p>
                    <p className="text-xs text-muted">{t("social.presenterVoiceDesc")}</p>
                    <label className="block text-xs text-muted">{t("social.presenterEdgeVoice")}</label>
                    <select
                      className={inputClass}
                      value={edgeVoice}
                      onChange={(e) => setEdgeVoice(e.target.value)}
                    >
                      {(edgeVoiceOptions.length
                        ? edgeVoiceOptions
                        : [{ id: edgeVoice, labelZh: edgeVoice, labelEn: edgeVoice }]
                      ).map((v) => (
                        <option key={v.id} value={v.id}>
                          {voiceLabel(v, locale)}
                        </option>
                      ))}
                    </select>
                    <label className="block text-xs text-muted">{t("social.presenterMacVoice")}</label>
                    <select
                      className={inputClass}
                      value={macVoice}
                      onChange={(e) => setMacVoice(e.target.value)}
                    >
                      {(macVoiceOptions.length
                        ? macVoiceOptions
                        : [{ id: macVoice, labelZh: macVoice, labelEn: macVoice }]
                      ).map((v) => (
                        <option key={v.id} value={v.id}>
                          {voiceLabel(v, locale)}
                        </option>
                      ))}
                    </select>
                    <label className="block text-xs text-muted">{t("social.presenterTtsPriority")}</label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["auto", t("social.presenterTtsAuto")],
                          ["piper", t("social.presenterTtsPiper")],
                          ["edge", t("social.presenterTtsEdge")],
                          ["mac", t("social.presenterTtsMac")],
                          ["minimax", t("social.presenterTtsMiniMax")],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTtsPriority(id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs ${
                            ttsPriority === id
                              ? "border-accent bg-accent/15 text-accent"
                              : "border-card-border text-muted"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
                      disabled={presenterSettingsSaving}
                      onClick={() => void savePresenterSettings()}
                    >
                      {presenterSettingsSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {t("social.presenterSettingsSave")}
                    </button>
                    {presenterSettingsHint ? (
                      <p
                        className={`text-xs ${
                          presenterSettingsHint === t("social.presenterSettingsSaved")
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {presenterSettingsHint}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
              {(platforms.includes("douyin") || platforms.includes("xiaohongshu")) && (
                <p className="mt-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
                  {t("social.douyinQuickStart")}
                </p>
              )}
            </div>

            <input
              className={inputClass}
              placeholder={t("social.topicPlaceholder")}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <button
              type="button"
              onClick={generateDraft}
              disabled={drafting || !topic.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-card-border px-3 py-2 text-sm hover:bg-card-border/50 disabled:opacity-50"
            >
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {platforms.includes("douyin") || platforms.includes("xiaohongshu")
                ? t("social.aiDraftWithMedia")
                : t("social.aiDraft")}
            </button>

            {(platforms.includes("douyin") || platforms.includes("xiaohongshu")) && (
              <div>
                <p className="mb-2 text-xs text-muted">{t("social.copyStyleLabel")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["viral", "pro", "story"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCopyStyle(s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        copyStyle === s
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-card-border text-muted"
                      }`}
                    >
                      {t(`social.copyStyles.${s}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              className={inputClass}
              placeholder={t("social.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <VoiceTextarea
              className={`${inputClass} min-h-[120px] resize-y`}
              placeholder={
                platforms.includes("douyin")
                  ? t("social.scriptPlaceholder")
                  : t("social.contentPlaceholder")
              }
              value={content}
              onValueChange={setContent}
            />
            {platforms.includes("douyin") && (
              <>
                <input
                  className={inputClass}
                  placeholder={t("social.publishCaptionPlaceholder")}
                  value={publishCaption}
                  onChange={(e) => setPublishCaption(e.target.value)}
                />
                <p className="text-xs text-muted">{t("social.douyinPersonalHint")}</p>
              </>
            )}
            <input
              className={inputClass}
              placeholder={t("social.imagePlaceholder")}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            {platforms.includes("xiaohongshu") && (
              <p className="text-xs text-muted">{t("social.xhsImageHint")}</p>
            )}
            {(platforms.includes("douyin") || platforms.includes("xiaohongshu")) && (
              <div className="rounded-lg border border-accent/25 bg-accent/5 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{t("social.mediaPackTitle")}</p>
                  <button
                    type="button"
                    onClick={() => void generateMedia()}
                    disabled={mediaLoading || !title.trim() || !content.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50"
                  >
                    {mediaLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Film className="h-3.5 w-3.5" />
                    )}
                    {t("social.generateMedia")}
                  </button>
                </div>
                <p className="text-xs text-muted">{t("social.mediaPackDesc")}</p>
                {mediaLoading && (
                  <p className="flex items-center gap-2 text-xs text-accent">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("social.mediaGenerating")}
                  </p>
                )}
                {mediaPack && !mediaLoading ? (
                  <div className="space-y-3">
                    {mediaPack.video && (
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <Film className="h-3.5 w-3.5" /> {t("social.videoPreview")}
                          </p>
                          {lastSpeechSource ? (
                            <Badge
                              variant={
                                lastSpeechSource === "silent" ? "warning" : "success"
                              }
                            >
                              {speechSourceLabel(lastSpeechSource)}
                            </Badge>
                          ) : null}
                        </div>
                        <video
                          key={videoCacheBust}
                          src={`${mediaPack.video.url}${mediaPack.video.url.includes("?") ? "&" : "?"}v=${videoCacheBust}`}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-64 w-full rounded-lg border border-card-border bg-black"
                        />
                        <a
                          href={mediaPack.video.url}
                          download={mediaPack.video.name}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Download className="h-3 w-3" /> {t("social.downloadVideo")}
                        </a>
                      </div>
                    )}
                    {mediaPack.slides.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1 text-xs font-medium text-foreground">
                          <ImageIcon className="h-3.5 w-3.5" /> {t("social.slidesPreview")}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {mediaPack.slides.map((s) => (
                            <a
                              key={s.url}
                              href={s.url}
                              download={s.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group overflow-hidden rounded-lg border border-card-border"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={s.url}
                                alt={s.name}
                                className="aspect-[9/16] w-full object-cover transition group-hover:opacity-90"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : !mediaLoading ? (
                  <p className="rounded-lg border border-dashed border-card-border px-3 py-6 text-center text-xs text-muted">
                    {t("social.mediaEmptyHint")}
                  </p>
                ) : null}
              </div>
            )}
            {platforms.includes("douyin") && (
              <p className="text-xs text-muted">{t("social.douyinPublishSteps")}</p>
            )}

            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-muted">
                <Calendar className="h-4 w-4" />
                {t("social.scheduleOptional")}
              </label>
              <input
                type="datetime-local"
                className={inputClass}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => savePost(true)}
                disabled={saving || !title.trim() || !content.trim()}
                className={btnPrimary}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("social.publishNow")}
              </button>
              <button
                type="button"
                onClick={() => savePost(false)}
                disabled={saving || !title.trim() || !content.trim()}
                className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-card-border/50 disabled:opacity-50"
              >
                {scheduledAt ? t("social.schedule") : t("social.saveDraft")}
              </button>
              {platforms.includes("xiaohongshu") && (
                <button
                  type="button"
                  onClick={copyForXhs}
                  disabled={!title.trim() && !content.trim()}
                  className="rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {t("social.xhsCopy")}
                </button>
              )}
              {platforms.includes("xiaohongshu") && (
                <a
                  href="https://creator.xiaohongshu.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:text-accent"
                >
                  {t("social.xhsCreatorLink")}
                </a>
              )}
              {platforms.includes("douyin") && (
                <button
                  type="button"
                  onClick={copyForDouyin}
                  disabled={!title.trim() && !content.trim()}
                  className="rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {t("social.douyinCopy")}
                </button>
              )}
              {platforms.includes("douyin") && (
                <a
                  href="https://creator.douyin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted hover:text-accent"
                >
                  {t("social.douyinCreatorLink")}
                </a>
              )}
            </div>

            {message && <p className="text-sm text-accent">{message}</p>}
            {cronUrl && (
              <p className="text-xs text-muted break-all">
                {t("social.cronHint")}: {cronUrl}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("social.postHistory")} description={t("social.postHistoryDesc")} />
          {loading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted">{t("social.noPosts")}</p>
          ) : (
            <div className="max-h-[600px] space-y-3 overflow-y-auto">
              {posts.map((post) => (
                <div key={post.id} className="rounded-lg border border-card-border bg-background/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{post.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{post.content}</p>
                    </div>
                    <Badge variant={statusVariant[post.status] ?? "muted"}>{post.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {post.platforms.map((p) => (
                      <Badge key={p} variant="muted">{t(`social.platforms.${p}`)}</Badge>
                    ))}
                  </div>
                  {post.scheduled_at && (
                    <p className="mt-1 text-xs text-muted">
                      {t("social.scheduledFor")}: {formatDateLocalized(post.scheduled_at, locale)}
                    </p>
                  )}
                  {Object.entries(post.publish_results).length > 0 && (
                    <div className="mt-2 space-y-1 text-xs">
                      {Object.entries(post.publish_results).map(([p, r]) => (
                        <p key={p} className={r?.ok ? "text-success" : "text-danger"}>
                          {t(`social.platforms.${p as SocialPlatform}`)}: {r?.ok ? "OK" : r?.error}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    {(post.status === "draft" || post.status === "scheduled" || post.status === "failed") && (
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        onClick={() => publishExisting(post.id)}
                      >
                        {t("social.publishNow")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-danger"
                      onClick={() => deletePost(post.id)}
                    >
                      <Trash2 className="inline h-3 w-3" /> {t("common.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
