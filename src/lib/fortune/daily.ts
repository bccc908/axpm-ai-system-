import "server-only";

import { sendEmail } from "@/lib/integrations/email/sender";
import { buildDailyFortuneEmail } from "@/lib/integrations/email/templates";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { generateFortuneReading, getChineseZodiac } from "@/lib/fortune/reading";
import {
  addScopedFortuneReading,
  ensureOwnerFortuneMigrated,
  fortuneScopeForRole,
  getOwnerFortuneScope,
  getScopedFortuneAutomation,
  getScopedFortuneProfile,
  getScopedFortuneFeedbackForPrompt,
  getScopedRecentDailyReadingsForPrompt,
  getScopedTopicReadingForDate,
  saveScopedFortuneAutomation,
} from "@/lib/fortune/context";
import type { FortuneProfile, FortuneReading } from "@/types/fortune";
import { getFortuneDateLabel, getDailyHexagramMoment, getFortuneYesterdayKey } from "@/lib/fortune/date";
import { isDuplicateDailyBody, isLegacyDailyReading } from "@/lib/fortune/daily-format";

const TIMEZONE = "Asia/Hong_Kong";

export function fortuneTodayKey(timezone = TIMEZONE) {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function trimForTelegram(text: string, max = 3400) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 20)}\n\n…（完整版见 AXPM Fortune 页面）`;
}

function readingLinesForTelegram(reading: string) {
  return reading
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return "";
      if (t.startsWith("## ")) return `\n<b>${escapeHtml(t.slice(3))}</b>`;
      return escapeHtml(t);
    })
    .filter(Boolean)
    .join("\n");
}

export function formatFortuneDailyTelegram(
  reading: FortuneReading,
  profile: FortuneProfile,
  locale: "en" | "zh",
) {
  const dateLabel = getFortuneDateLabel(locale);

  const header =
    locale === "zh"
      ? `📋 <b>每日决策简报</b>\n📅 ${escapeHtml(dateLabel)}`
      : `📋 <b>Daily Decision Brief</b>\n📅 ${escapeHtml(dateLabel)}`;

  const nameLine = profile.name
    ? locale === "zh"
      ? `\n👤 ${escapeHtml(profile.name)}`
      : `\n👤 ${escapeHtml(profile.name)}`
    : "";

  const lines = [
    header + nameLine,
    "",
    `<b>${escapeHtml(reading.title)}</b>`,
    reading.summary ? `<i>${escapeHtml(reading.summary)}</i>` : "",
    "",
    readingLinesForTelegram(reading.reading),
  ];

  if (reading.zodiac || reading.lucky) {
    lines.push("");
    if (reading.zodiac) {
      lines.push(
        locale === "zh"
          ? `生肖：${escapeHtml(reading.zodiac)}`
          : `Zodiac: ${escapeHtml(reading.zodiac)}`,
      );
    }
    if (reading.lucky?.color) {
      lines.push(
        locale === "zh"
          ? `幸运色：${escapeHtml(reading.lucky.color)} · 数字 ${escapeHtml(reading.lucky.number ?? "—")} · ${escapeHtml(reading.lucky.keyword ?? "")}`
          : `Lucky: ${escapeHtml(reading.lucky.color)} · ${escapeHtml(reading.lucky.number ?? "—")} · ${escapeHtml(reading.lucky.keyword ?? "")}`,
      );
    }
  }

  lines.push(
    "",
    locale === "zh"
      ? "<i>仅供娱乐与个人反思 · AXPM Fortune</i>"
      : "<i>For reflection only · AXPM Fortune</i>",
  );

  return trimForTelegram(lines.filter((line) => line !== undefined).join("\n"), 3900);
}

async function prepareDailyFortuneReading(
  scope: Awaited<ReturnType<typeof getOwnerFortuneScope>>,
  options?: { force?: boolean },
) {
  if (!scope) {
    return { ok: false as const, reason: "no_owner" as const, today: fortuneTodayKey() };
  }

  await ensureOwnerFortuneMigrated(scope);
  const automation = await getScopedFortuneAutomation(scope);
  const today = fortuneTodayKey();
  const profile = await getScopedFortuneProfile(scope);
  const locale = automation.daily_locale;

  let reading: FortuneReading;
  let usedAi = true;

  const cached = await getScopedTopicReadingForDate(scope, "daily", today);
  let useCache = Boolean(cached && !options?.force);
  if (useCache && cached) {
    if (isLegacyDailyReading(cached.reading)) {
      useCache = false;
    } else {
      const yesterday = await getScopedTopicReadingForDate(
        scope,
        "daily",
        getFortuneYesterdayKey(),
      );
      if (yesterday && isDuplicateDailyBody(cached.reading, yesterday.reading)) {
        useCache = false;
      }
    }
  }

  if (useCache && cached) {
    reading = cached;
    usedAi = false;
  } else {
    const generated = await generateFortuneReading({
      topic: "daily",
      profile,
      locale,
      mode: "platform",
      hexDate: getDailyHexagramMoment(today),
      feedbackLearnings: await getScopedFortuneFeedbackForPrompt(scope, locale),
      recentReadings: await getScopedRecentDailyReadingsForPrompt(scope, 6),
    });
    usedAi = generated.usedAi;

    const zodiac =
      generated.zodiac ??
      (profile.birth_date ? getChineseZodiac(profile.birth_date, locale) : null);

    reading = await addScopedFortuneReading(scope, {
      topic: "daily",
      question: null,
      title: generated.title,
      reading: generated.reading,
      summary: generated.summary,
      lucky: generated.lucky,
      zodiac,
      fortune_date:
        "fortune_date" in generated && generated.fortune_date
          ? generated.fortune_date
          : today,
    });
  }

  return {
    ok: true as const,
    scope,
    automation,
    today,
    profile,
    locale,
    reading,
    usedAi,
  };
}

export async function runDailyFortune(options?: { force?: boolean; ownerUserId?: string }) {
  const scope = options?.ownerUserId
    ? fortuneScopeForRole(options.ownerUserId, "owner")
    : await getOwnerFortuneScope();

  const automation = scope ? await getScopedFortuneAutomation(scope) : null;
  const today = fortuneTodayKey();

  if (automation && !automation.daily_telegram_enabled && !options?.force) {
    return {
      ok: true as const,
      skipped: true,
      reason: "disabled" as const,
      today,
    };
  }

  if (automation?.last_daily_sent === today && !options?.force) {
    return {
      ok: true as const,
      skipped: true,
      reason: "already_sent" as const,
      today,
      last_daily_sent: automation.last_daily_sent,
    };
  }

  const prepared = await prepareDailyFortuneReading(scope, options);
  if (!prepared.ok) {
    return {
      ok: false as const,
      skipped: true,
      reason: prepared.reason,
      today: prepared.today,
    };
  }

  const { reading, profile, locale, usedAi } = prepared;
  const message = formatFortuneDailyTelegram(reading, profile, locale);
  const telegram = await sendTelegramMessage(message);

  if (!telegram.ok) {
    return {
      ok: true as const,
      skipped: false,
      partial: true as const,
      reading,
      telegram,
      today: prepared.today,
      usedAi,
    };
  }

  await saveScopedFortuneAutomation(prepared.scope, { last_daily_sent: prepared.today });

  return {
    ok: true as const,
    skipped: false,
    reading,
    telegram: { ok: true as const },
    today: prepared.today,
    usedAi,
  };
}

export async function runDailyFortuneEmail(options?: { force?: boolean; ownerUserId?: string }) {
  const scope = options?.ownerUserId
    ? fortuneScopeForRole(options.ownerUserId, "owner")
    : await getOwnerFortuneScope();

  const today = fortuneTodayKey();

  if (!scope) {
    return {
      ok: false as const,
      skipped: true,
      reason: "no_owner" as const,
      today,
    };
  }

  const automation = await getScopedFortuneAutomation(scope);

  if (automation.last_daily_email_sent === today && !options?.force) {
    return {
      ok: true as const,
      skipped: true,
      reason: "already_sent" as const,
      today,
      last_daily_email_sent: automation.last_daily_email_sent,
    };
  }

  const prepared = await prepareDailyFortuneReading(scope, options);
  if (!prepared.ok) {
    return {
      ok: false as const,
      skipped: true,
      reason: prepared.reason,
      today: prepared.today,
    };
  }

  const { reading, profile, locale } = prepared;
  const dateLabel = getFortuneDateLabel(locale);
  const content = buildDailyFortuneEmail({
    locale,
    dateLabel,
    name: profile.name,
    title: reading.title,
    summary: reading.summary,
    reading: reading.reading,
    zodiac: reading.zodiac,
    lucky: reading.lucky,
  });

  const email = await sendEmail(content, { type: "daily_fortune" });

  if (!email.ok) {
    return {
      ok: false as const,
      skipped: false,
      partial: true as const,
      reading,
      email: { ok: false as const, error: email.error },
      today: prepared.today,
      usedAi: prepared.usedAi,
    };
  }

  await saveScopedFortuneAutomation(prepared.scope, { last_daily_email_sent: prepared.today });

  return {
    ok: true as const,
    skipped: false,
    reading,
    email: { ok: true as const, messageId: email.messageId },
    today: prepared.today,
    usedAi: prepared.usedAi,
  };
}
