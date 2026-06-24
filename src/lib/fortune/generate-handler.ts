import "server-only";

import { z } from "zod";
import { generateFortuneReading } from "@/lib/fortune/reading";
import { getFortuneTodayKey, getDailyHexagramMoment, getFortuneYesterdayKey } from "@/lib/fortune/date";
import { isDuplicateDailyBody, isLegacyDailyReading } from "@/lib/fortune/daily-format";
import { CACHEABLE_DAILY_TOPICS } from "@/lib/fortune/store";
import {
  addScopedFortuneReading,
  fortuneScopeForRole,
  getScopedFortuneProfile,
  getScopedFortuneReadingById,
  getScopedRecentReadingsForPrompt,
  getScopedRecentDailyReadingsForPrompt,
  getScopedFortuneFeedbackMeta,
  getScopedTopicReadingForDate,
  isScopedReadingShareUnlocked,
  usesOwnerAiPrompts,
} from "@/lib/fortune/context";
import { shareRequiredForFollowUp } from "@/lib/fortune/share-gate";
import {
  canGenerateReading,
  getCustomerDeepSeekConfig,
  getOrCreateCustomerAccount,
  recordReadingUsage,
} from "@/lib/customer/store";
import type { UserRole } from "@/lib/auth/types";
import { sendFortuneQuestionTelegram } from "@/lib/fortune/telegram";
import { generateMianxiangFromPhoto } from "@/lib/fortune/mianxiang-vision";

export const fortuneGenerateSchema = z.object({
  topic: z.enum([
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
  ]),
  question: z.string().max(800).nullable().optional(),
  locale: z.enum(["en", "zh"]).optional(),
  force: z.boolean().optional(),
  contextReadingId: z.string().uuid().optional(),
  faceImage: z
    .object({
      data: z.string().min(100).max(900_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    })
    .optional(),
});

export async function handleFortuneGenerate(params: {
  userId: string;
  role: UserRole;
  body: z.infer<typeof fortuneGenerateSchema>;
  skipQuota?: boolean;
}) {
  const scope = fortuneScopeForRole(params.userId, params.role);
  const isCustomer = params.role === "customer";
  const ownerPrompts = usesOwnerAiPrompts(params.role);
  const isFollowUp = Boolean(params.body.contextReadingId && params.body.question?.trim());

  if (isFollowUp && shareRequiredForFollowUp(params.role)) {
    const parentId = params.body.contextReadingId!;
    const unlocked = await isScopedReadingShareUnlocked(scope, parentId);
    if (!unlocked) {
      return {
        status: 403 as const,
        body: {
          error: "share_required",
          message: "Share this reading before asking a follow-up question",
          readingId: parentId,
        },
      };
    }
  }

  if (isCustomer && !params.skipQuota) {
    const quota = await canGenerateReading(params.userId);
    if (!quota.ok) {
      return {
        status: 402 as const,
        body: { error: quota.reason ?? "Quota exceeded" },
      };
    }
  }

  const profile = await getScopedFortuneProfile(scope);
  const locale = params.body.locale ?? "en";
  const force = params.body.force === true;
  const hasQuestion = Boolean(params.body.question?.trim());
  const todayKey = getFortuneTodayKey();

  if (
    !force &&
    !hasQuestion &&
    !params.body.contextReadingId &&
    CACHEABLE_DAILY_TOPICS.includes(params.body.topic)
  ) {
    const cached = await getScopedTopicReadingForDate(scope, params.body.topic, todayKey);
    if (cached) {
      const staleLegacy =
        params.body.topic === "daily" && isLegacyDailyReading(cached.reading);
      let staleDuplicate = false;
      if (params.body.topic === "daily" && !staleLegacy) {
        const yesterday = await getScopedTopicReadingForDate(
          scope,
          "daily",
          getFortuneYesterdayKey(),
        );
        staleDuplicate = Boolean(
          yesterday && isDuplicateDailyBody(cached.reading, yesterday.reading),
        );
      }
      if (!staleLegacy && !staleDuplicate) {
        return {
          status: 200 as const,
          body: { reading: cached, usedAi: true, cached: true, feedbackCount: 0 },
        };
      }
    }
  }

  const contextReading = params.body.contextReadingId
    ? await getScopedFortuneReadingById(scope, params.body.contextReadingId)
    : null;

  const isMianxiangPhoto =
    params.body.topic === "mianxiang" && Boolean(params.body.faceImage);

  const recentReadings = isMianxiangPhoto
    ? []
    : params.body.topic === "daily"
      ? await getScopedRecentDailyReadingsForPrompt(scope, 6)
      : await getScopedRecentReadingsForPrompt(scope, 4);

  const feedbackMeta = ownerPrompts
    ? await getScopedFortuneFeedbackMeta(scope, locale)
    : { learnings: null, count: 0 };
  const feedbackLearnings = feedbackMeta.learnings;

  let aiConfig: { apiKey?: string; baseUrl?: string; model?: string } | undefined;
  if (isCustomer) {
    const account = await getOrCreateCustomerAccount(params.userId);
    const cfg = getCustomerDeepSeekConfig(account);
    if (!cfg) {
      return {
        status: 400 as const,
        body: {
          error: "Add your DeepSeek API key in Account settings before asking fortune",
        },
      };
    }
    aiConfig = cfg;
  }

  const result =
    params.body.topic === "mianxiang" && params.body.faceImage
      ? await (async () => {
          const vision = await generateMianxiangFromPhoto({
            faceImage: params.body.faceImage!,
            profile,
            locale,
            question: params.body.question ?? null,
            mode: ownerPrompts ? "platform" : "customer",
            aiConfig,
          });
          if (!vision.ok) {
            return { error: vision.error, failed: true as const };
          }
          return {
            title: vision.title,
            summary: vision.summary,
            reading: vision.reading,
            lucky: vision.lucky,
            zodiac: vision.zodiac,
            usedAi: vision.usedAi,
            fortune_date: vision.fortune_date,
            failed: false as const,
          };
        })()
      : await generateFortuneReading({
          topic: params.body.topic,
          question: params.body.question ?? null,
          profile,
          locale,
          contextReading,
          recentReadings,
          feedbackLearnings,
          mode: ownerPrompts ? "platform" : "customer",
          aiConfig,
          hexDate: params.body.topic === "daily" ? getDailyHexagramMoment() : undefined,
        });

  if ("failed" in result && result.failed) {
    return {
      status: 400 as const,
      body: { error: result.error },
    };
  }

  const readingResult = result as Awaited<ReturnType<typeof generateFortuneReading>>;

  const reading = await addScopedFortuneReading(scope, {
    topic: params.body.topic,
    question: params.body.question?.trim() || null,
    title: readingResult.title,
    reading: readingResult.reading,
    summary: readingResult.summary,
    lucky: readingResult.lucky,
    zodiac: readingResult.zodiac,
    fortune_date: "fortune_date" in readingResult ? readingResult.fortune_date ?? null : null,
  });

  if (isCustomer && !params.skipQuota) {
    await recordReadingUsage(params.userId);
  }

  let telegram:
    | { ok: true; sent?: true; skipped?: true; reason?: string }
    | { ok: false; error: string }
    | null = null;

  if (reading.question?.trim() && params.role === "owner") {
    telegram = await sendFortuneQuestionTelegram({
      reading,
      profile,
      locale,
      contextReading,
    });
  }

  return {
    status: 200 as const,
    body: {
      reading,
      usedAi: readingResult.usedAi,
      aiError: "aiError" in readingResult ? readingResult.aiError : undefined,
      feedbackCount: feedbackMeta.count,
      telegram,
    },
  };
}
