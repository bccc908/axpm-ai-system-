import "server-only";

import { z } from "zod";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import type {
  FortuneFeedbackChatMessage,
  FortuneFeedbackRating,
  FortuneReading,
} from "@/types/fortune";
import { getFortuneTodayKey, getFortuneTomorrowKey } from "@/lib/fortune/date";
import { normalizeRating } from "@/lib/fortune/analyze-feedback";
import { fortuneAdvisorPersonaBlock } from "@/lib/fortune/advisor-persona";

const turnSchema = z.object({
  reply: z.string().min(1),
  draft: z.object({
    rating: z.enum(["accurate", "partial", "wrong"]).nullable().optional(),
    actual_outcome: z.string().nullable().optional(),
    errors: z.string().nullable().optional(),
    correction_notes: z.string().nullable().optional(),
  }),
  ask_follow_up: z.string().nullable().optional(),
});

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : JSON.stringify(item)))
      .filter(Boolean)
      .join("\n");
  }
  if (value == null) return "";
  return String(value).trim();
}

function stripJsonFence(content: string) {
  const t = content.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : t;
}

function parseJsonLoose(content: string): Record<string, unknown> {
  const stripped = stripJsonFence(content);
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("invalid json");
  }
}

function normalizeTurnRaw(raw: Record<string, unknown>) {
  const draftRaw =
    raw.draft && typeof raw.draft === "object" && !Array.isArray(raw.draft)
      ? (raw.draft as Record<string, unknown>)
      : {};

  const ratingRaw = draftRaw.rating ?? draftRaw.评分;
  const rating =
    ratingRaw !== undefined && ratingRaw !== null && toText(ratingRaw) !== ""
      ? normalizeRating(ratingRaw)
      : null;

  return {
    reply: toText(raw.reply ?? raw.回复 ?? raw.message ?? raw.content ?? raw.text),
    draft: {
      rating,
      actual_outcome: toText(draftRaw.actual_outcome ?? draftRaw.实际 ?? draftRaw.actual) || null,
      errors: toText(draftRaw.errors ?? draftRaw.偏差 ?? draftRaw.说错) || null,
      correction_notes: toText(
        draftRaw.correction_notes ?? draftRaw.改进 ?? draftRaw.correctionNotes,
      ) || null,
    },
    ask_follow_up: toText(raw.ask_follow_up ?? raw.追问 ?? raw.follow_up ?? raw.followUp) || null,
  };
}

function buildReadingContext(reading: FortuneReading) {
  return [
    reading.fortune_date ? `日期：${reading.fortune_date}` : null,
    reading.topic ? `类型：${reading.topic}` : null,
    reading.question?.trim() ? `问事：${reading.question.trim()}` : null,
    `标题：${reading.title}`,
    reading.summary ? `摘要：${reading.summary}` : null,
    reading.reading ? `正文：\n${reading.reading.slice(0, 4000)}` : null,
    reading.lucky
      ? `吉凶参考：${[reading.lucky.color, reading.lucky.number, reading.lucky.direction, reading.lucky.keyword]
          .filter(Boolean)
          .join(" / ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatHistory(messages: FortuneFeedbackChatMessage[]) {
  return messages
    .slice(-16)
    .map((m) => (m.role === "user" ? `用户：${m.content}` : `助手：${m.content}`))
    .join("\n\n");
}

function mergeDraft(
  prev:
    | {
        rating: FortuneFeedbackRating | null;
        actual_outcome: string | null;
        errors: string | null;
        correction_notes: string | null;
      }
    | undefined,
  next: z.infer<typeof turnSchema>["draft"],
) {
  return {
    rating: normalizeRating(next.rating ?? prev?.rating ?? "partial"),
    actual_outcome: next.actual_outcome?.trim() || prev?.actual_outcome || null,
    errors: next.errors?.trim() || prev?.errors || null,
    correction_notes: next.correction_notes?.trim() || prev?.correction_notes || null,
  };
}

function buildSystemPromptZh(params: {
  profileNotes: string | null;
  feedbackLearnings: string | null;
}) {
  const profileBlock = params.profileNotes
    ? `\n【Kayden 档案（复盘时须对照，勿脱离背景空谈）】\n${params.profileNotes.slice(0, 2000)}\n`
    : "";

  const learningsBlock = params.feedbackLearnings
    ? `\n${params.feedbackLearnings}\n`
    : "";

  return `${fortuneAdvisorPersonaBlock("zh")}

你跟 Kayden 聊天复盘，像对面坐着说话，不像交报告。

【怎么说话 — 最重要】
- 先接住他的话，他问什么先答什么（出门时辰、准不准、累不累…）
- 短句、口语，80–200 字一轮够了；可以「说白了」「我坦说」「你记得吗」
- 有据但不念稿：引用分析原话和用户事实，用说话方式带出来，不要「分析写：｜实际：｜偏差：」这种表格腔
- 敢纠正他，但别堆「硬伤」「审计」「纠正方案」这类办公词

【禁止出现在 reply 里】
- 编号清单 1.2.3.、①②③、**加粗**、markdown、小标题
- 长段道歉、客服腔「收到您的反馈」
- 没回答问题就开始列今日文稿问题

【内容】
- 他质疑准不准：直接说哪几句准、哪几句偏，别绕
- 问明天/时辰/回济南：若有「明日每日运势」文稿，用口语概括明天运程与宜忌，给具体时段（巳时、申时等），一句理由即可
- 主动挑刺可以，但像随口提醒两句，不要三条硬伤清单
- draft 里悄悄记 errors / correction_notes，reply 里别写成表格

${profileBlock}${learningsBlock}
【开场】他还没说：像发微信——「今天的稿我看了，有两处我觉得有点套…你今天过得怎样？」

【输出 JSON】reply 必须是自然对话体；draft 给后台用，可结构化。
{
  "reply": "口语化对话",
  "draft": { "rating", "actual_outcome", "errors", "correction_notes" },
  "ask_follow_up": "一句口语追问（会拼进 reply）"
}`;
}

function buildSystemPromptEn(params: {
  profileNotes: string | null;
  feedbackLearnings: string | null;
}) {
  const profileBlock = params.profileNotes
    ? `\n[Kayden profile]\n${params.profileNotes.slice(0, 2000)}\n`
    : "";
  const learningsBlock = params.feedbackLearnings ? `\n${params.feedbackLearnings}\n` : "";

  return `${fortuneAdvisorPersonaBlock("en")}

Senior fortune review advisor for Kayden. Calibrate today's reading vs actual events — not generic chat.
Cite specific claims from the reading vs specific facts the user stated.
No fluff. No assuming projects unless user confirmed.
reply: 150-350 words, structured: facts → accurate points → gaps with "Reading said | Actual | Gap" → one rule for tomorrow.
Always end with one specific follow-up question.
JSON: reply, draft (rating, actual_outcome, errors, correction_notes), ask_follow_up.${profileBlock}${learningsBlock}`;
}

function buildTomorrowDailyBlock(readings: FortuneReading[], currentDate: string | null | undefined) {
  const base = currentDate ?? getFortuneTodayKey();
  const tomorrow = getFortuneTomorrowKey(new Date(`${base}T12:00:00`));
  const item = readings.find(
    (r) => r.topic === "daily" && r.fortune_date === tomorrow && !r.question?.trim(),
  );
  if (!item) return "";
  return `【明日每日运势 ${tomorrow}】\n${item.title}\n摘要：${item.summary ?? "—"}\n正文节选：${(item.reading ?? "").slice(0, 1200)}`;
}

function buildRecentDailyBlock(readings: FortuneReading[], currentId: string) {
  const items = readings
    .filter((r) => r.topic === "daily" && r.fortune_date && r.id !== currentId)
    .sort((a, b) => (b.fortune_date ?? "").localeCompare(a.fortune_date ?? ""))
    .slice(0, 3);

  if (items.length === 0) return "";

  return items
    .map(
      (r) =>
        `【${r.fortune_date}】${r.title}\n摘要：${r.summary ?? "—"}\n正文节选：${(r.reading ?? "").slice(0, 600)}`,
    )
    .join("\n\n");
}

function humanizeReply(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[.)）、]\s*/gm, "")
    .replace(/[【】]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function runFeedbackChatTurn(params: {
  reading: FortuneReading;
  messages: FortuneFeedbackChatMessage[];
  locale: "en" | "zh";
  isFirstTurn: boolean;
  isKickoff?: boolean;
  recentDailyReadings?: FortuneReading[];
  profileNotes?: string | null;
  feedbackLearnings?: string | null;
  prevDraft?: {
    rating: FortuneFeedbackRating | null;
    actual_outcome: string | null;
    errors: string | null;
    correction_notes: string | null;
  };
}) {
  const readingContext = buildReadingContext(params.reading);
  const history = formatHistory(params.messages);
  const lastUser = [...params.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const recentBlock = buildRecentDailyBlock(params.recentDailyReadings ?? [], params.reading.id);
  const tomorrowBlock = buildTomorrowDailyBlock(
    params.recentDailyReadings ?? [],
    params.reading.fortune_date,
  );
  const recentContext = recentBlock
    ? params.locale === "zh"
      ? `\n【近几日每日运势（须主动对比是否套话雷同）】\n${recentBlock}\n`
      : `\n[Recent daily readings — compare for template duplication]\n${recentBlock}\n`
    : "";
  const tomorrowContext = tomorrowBlock
    ? params.locale === "zh"
      ? `\n${tomorrowBlock}\n（用户问明天运程时，优先用这段明日稿口语作答）\n`
      : `\n${tomorrowBlock}\n(Use for tomorrow fortune questions)\n`
    : "";

  const systemPrompt =
    params.locale === "zh"
      ? buildSystemPromptZh({
          profileNotes: params.profileNotes ?? null,
          feedbackLearnings: params.feedbackLearnings ?? null,
        })
      : buildSystemPromptEn({
          profileNotes: params.profileNotes ?? null,
          feedbackLearnings: params.feedbackLearnings ?? null,
        });

  const draftContext =
    params.prevDraft?.actual_outcome || params.prevDraft?.errors
      ? `\n【当前草稿】\n实际：${params.prevDraft.actual_outcome ?? "—"}\n偏差：${params.prevDraft.errors ?? "—"}\n改进规则：${params.prevDraft.correction_notes ?? "—"}`
      : "";

  const userContent = params.isKickoff
    ? params.locale === "zh"
      ? `【今日命理解读】
${readingContext}
${recentContext}
${tomorrowContext}
${draftContext}

Kayden 还没开口。像朋友发微信：随口说你看完今天稿子的两点感受，问他今天实际怎样。不要列清单，不要写报告。`
      : `Today's reading:\n${readingContext}${recentContext}${tomorrowContext}\n\nUser has not spoken. Lead with proactive audit of today's text vs recent days, then ask what actually happened.`
    : params.locale === "zh"
      ? `【今日命理解读】
${readingContext}
${recentContext}
${tomorrowContext}
${draftContext}

【对话记录】
${history}

请回复用户最新一句：「${lastUser}」
${params.isFirstTurn ? "（先直接答他的问题，口语、自然，再顺带纠偏）" : "（接着聊，别重复上句）"}`
      : `Reading:\n${readingContext}${recentContext}${tomorrowContext}${draftContext}\n\nChat:\n${history}\n\nReply to: ${lastUser}`;

  const ai = await deepSeekChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    json: true,
    temperature: 0.52,
    maxTokens: 1600,
  });

  if (!ai.ok) {
    return { ok: false as const, error: ai.error };
  }

  const finish = (parsed: z.infer<typeof turnSchema>) => {
    let reply = humanizeReply(parsed.reply.trim());
    const followUp = parsed.ask_follow_up?.trim();
    if (followUp && !reply.includes(followUp)) {
      reply = `${reply}\n\n${humanizeReply(followUp)}`;
    } else if (!followUp && !reply.match(/[？?]$/)) {
      reply = `${reply}\n\n${params.locale === "zh" ? "还有啥想对一下的？" : "Anything else?"}`;
    }
    const draft = mergeDraft(params.prevDraft, parsed.draft);
    return { ok: true as const, reply, draft };
  };

  try {
    const raw = parseJsonLoose(ai.content);
    const normalized = normalizeTurnRaw(raw);
    if (!normalized.reply) {
      throw new Error("empty reply");
    }
    const parsed = turnSchema.parse({
      ...normalized,
      draft: normalized.draft,
    });
    return finish(parsed);
  } catch {
    try {
      const raw = parseJsonLoose(ai.content);
      const normalized = normalizeTurnRaw(raw);
      if (normalized.reply) {
        const relaxed = turnSchema
          .extend({
            draft: z.object({
              rating: z.enum(["accurate", "partial", "wrong"]).nullable().optional(),
              actual_outcome: z.string().nullable().optional(),
              errors: z.string().nullable().optional(),
              correction_notes: z.string().nullable().optional(),
            }),
          })
          .parse(normalized);
        return finish(relaxed);
      }
    } catch {
      /* fall through */
    }

    const plain = stripJsonFence(ai.content);
    if (plain.length > 20) {
      try {
        const salvaged = normalizeTurnRaw(parseJsonLoose(plain));
        if (salvaged.reply) {
          return finish({
            reply: salvaged.reply,
            draft: salvaged.draft,
            ask_follow_up: salvaged.ask_follow_up,
          });
        }
      } catch {
        /* continue */
      }
      if (!plain.startsWith("{")) {
        return finish({
          reply: plain,
          draft: {},
          ask_follow_up: null,
        });
      }
    }

    if (process.env.DEBUG_FEEDBACK_CHAT === "1") {
      console.error("[feedback-chat] parse failed, content:", ai.content.slice(0, 2000));
    }

    return { ok: false as const, error: "AI 回复格式异常，请重试" };
  }
}
