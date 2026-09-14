import Link from "next/link";
import type { Route } from "next";
import { Sparkles } from "lucide-react";
import { FortuneReadingBody } from "@/components/fortune/fortune-reading-body";
import {
  fortuneTopicLabel,
  getPublicFortuneShareByToken,
} from "@/lib/fortune/public-share";

export default async function PublicFortuneSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const locale = lang === "en" ? "en" : "zh";
  const share = await getPublicFortuneShareByToken(token, locale);

  if (!share) {
    return (
      <main className="premium-canvas flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="glass-panel max-w-md rounded-2xl p-8">
          <p className="font-display text-xl font-semibold text-gradient-gold">
            {locale === "zh" ? "分享链接无效或已过期" : "This share link is invalid or expired"}
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex rounded-xl btn-premium px-5 py-2.5 text-sm"
          >
            {locale === "zh" ? "注册体验Grok Trading" : "Try Grok Trading"}
          </Link>
        </div>
      </main>
    );
  }

  const topicLabel = fortuneTopicLabel(share.topic, locale);

  return (
    <main className="premium-canvas min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <p className="badge-shimmer inline-flex items-center gap-1.5 rounded-full border border-accent/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            {share.brand} · {topicLabel}
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-gradient-gold">
            {share.title}
          </h1>
          {share.summary ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">{share.summary}</p>
          ) : null}
        </header>

        <article className="glass-panel rounded-2xl p-6 md:p-8">
          <FortuneReadingBody text={share.reading} />
        </article>

        {share.lucky ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {share.lucky.color ? (
              <div className="glass-panel rounded-xl px-3 py-3 text-center text-xs">
                <div className="text-muted">{locale === "zh" ? "幸运色" : "Color"}</div>
                <div className="mt-1 font-medium text-foreground">{share.lucky.color}</div>
              </div>
            ) : null}
            {share.lucky.number ? (
              <div className="glass-panel rounded-xl px-3 py-3 text-center text-xs">
                <div className="text-muted">{locale === "zh" ? "幸运数" : "Number"}</div>
                <div className="mt-1 font-medium text-foreground">{share.lucky.number}</div>
              </div>
            ) : null}
            {share.lucky.direction ? (
              <div className="glass-panel rounded-xl px-3 py-3 text-center text-xs">
                <div className="text-muted">{locale === "zh" ? "方位" : "Direction"}</div>
                <div className="mt-1 font-medium text-foreground">{share.lucky.direction}</div>
              </div>
            ) : null}
            {share.lucky.keyword ? (
              <div className="glass-panel rounded-xl px-3 py-3 text-center text-xs">
                <div className="text-muted">{locale === "zh" ? "关键词" : "Keyword"}</div>
                <div className="mt-1 font-medium text-foreground">{share.lucky.keyword}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="glass-panel mt-8 rounded-2xl border-accent/25 p-6 text-center shadow-[0_0_48px_-16px_var(--accent-glow)]">
          <p className="text-sm font-medium text-foreground">
            {locale === "zh" ? "你也想测一次？" : "Want your own reading?"}
          </p>
          <Link
            href={share.signupUrl as Route}
            className="mt-4 inline-flex rounded-xl btn-premium px-6 py-3 text-sm"
          >
            {locale === "zh" ? "免费注册 · 开始占卜" : "Sign up free"}
          </Link>
        </div>

        <p className="mt-8 text-center text-[11px] text-muted">
          {locale === "zh"
            ? "仅供娱乐与个人反思，非医疗/法律/投资建议"
            : "For entertainment and reflection only — not professional advice"}
        </p>
      </div>
    </main>
  );
}
