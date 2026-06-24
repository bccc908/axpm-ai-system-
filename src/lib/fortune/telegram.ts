import "server-only";

import { sendTelegramMessage, getTelegramConfig } from "@/lib/integrations/telegram";
import { getFortuneDateLabel } from "@/lib/fortune/date";
import { getFortuneAutomation } from "@/lib/fortune/store";
import type { FortuneProfile, FortuneReading, FortuneTopic } from "@/types/fortune";

const TOPIC_ZH: Record<FortuneTopic, string> = {
  daily: "今日运势",
  career: "事业运",
  wealth: "财运",
  love: "感情运",
  general: "综合运势",
  astro: "星座运势",
  tarot: "塔罗占卜",
  numerology: "数字命理",
  ziwei: "紫微斗数",
  meihua: "梅花易数",
  yijing: "易经",
  chenggu: "称骨算命",
  mianxiang: "面相分析",
  combined: "多维综合",
  custom: "问事",
};

const TOPIC_EN: Record<FortuneTopic, string> = {
  daily: "Daily",
  career: "Career",
  wealth: "Wealth",
  love: "Love",
  general: "Life path",
  astro: "Astrology",
  tarot: "Tarot",
  numerology: "Numerology",
  ziwei: "Zi Wei",
  meihua: "Meihua",
  yijing: "I Ching",
  chenggu: "Bone weight",
  mianxiang: "Face reading",
  combined: "Combined",
  custom: "Q&A",
};

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

export function formatFortuneQuestionTelegram(
  reading: FortuneReading,
  profile: FortuneProfile,
  locale: "en" | "zh",
  contextReading?: FortuneReading | null,
) {
  const dateLabel = getFortuneDateLabel(locale);
  const topicLabel = locale === "zh" ? TOPIC_ZH[reading.topic] : TOPIC_EN[reading.topic];

  const header =
    locale === "zh"
      ? `💬 <b>命理问事 · ${escapeHtml(topicLabel)}</b>\n📅 ${escapeHtml(dateLabel)}`
      : `💬 <b>Fortune Q&amp;A · ${escapeHtml(topicLabel)}</b>\n📅 ${escapeHtml(dateLabel)}`;

  const nameLine = profile.name
    ? `\n👤 ${escapeHtml(profile.name)}`
    : "";

  const lines = [
    header + nameLine,
    "",
    locale === "zh"
      ? `<b>❓ 你的问题</b>\n${escapeHtml(reading.question ?? "—")}`
      : `<b>❓ Your question</b>\n${escapeHtml(reading.question ?? "—")}`,
  ];

  if (contextReading) {
    lines.push(
      "",
      locale === "zh"
        ? `<i>↩ 追问自：${escapeHtml(contextReading.title)}</i>`
        : `<i>↩ Follow-up to: ${escapeHtml(contextReading.title)}</i>`,
    );
  }

  lines.push(
    "",
    `<b>${escapeHtml(reading.title)}</b>`,
    reading.summary ? `<i>${escapeHtml(reading.summary)}</i>` : "",
    "",
    readingLinesForTelegram(reading.reading),
    "",
    locale === "zh"
      ? "<i>仅供娱乐与个人反思 · AXPM Fortune</i>"
      : "<i>For reflection only · AXPM Fortune</i>",
  );

  return trimForTelegram(lines.filter(Boolean).join("\n"), 3900);
}

export async function sendFortuneQuestionTelegram(input: {
  reading: FortuneReading;
  profile: FortuneProfile;
  locale: "en" | "zh";
  contextReading?: FortuneReading | null;
}) {
  const automation = await getFortuneAutomation();
  if (!automation.question_telegram_enabled) {
    return { ok: true as const, skipped: true as const, reason: "disabled" as const };
  }

  if (!getTelegramConfig().isReady) {
    return { ok: true as const, skipped: true as const, reason: "not_configured" as const };
  }

  if (!input.reading.question?.trim()) {
    return { ok: true as const, skipped: true as const, reason: "no_question" as const };
  }

  const message = formatFortuneQuestionTelegram(
    input.reading,
    input.profile,
    input.locale,
    input.contextReading,
  );
  const telegram = await sendTelegramMessage(message);
  if (!telegram.ok) {
    return { ok: false as const, error: telegram.error };
  }
  return { ok: true as const, sent: true as const };
}
