import "server-only";

import type {
  FortuneFeedbackChatMessage,
  FortuneFeedbackChatSession,
  FortuneFeedbackRating,
  FortuneReading,
} from "@/types/fortune";
import { formatFeedbackLearningsBlock } from "@/lib/fortune/feedback";
import { readUserFortuneDataExport, writeUserFortuneDataFull } from "@/lib/fortune/user-store";
import { runFeedbackChatTurn } from "@/lib/fortune/feedback-chat-ai";

function mapFeedbackChatError(error: string, locale: "en" | "zh") {
  if (locale !== "zh") return error;
  if (error.includes("empty response")) return "AI 暂时没回上话，请再点一次发送";
  if (error.includes("timed out")) return "AI 响应超时，请重试";
  if (error.includes("rate limit")) return "请求太频繁，稍等几秒再试";
  if (error.includes("Insufficient Balance")) return "DeepSeek 余额不足，请充值后重试";
  if (error.includes("格式异常")) return error;
  return error;
}

export async function getFeedbackChatSession(
  userId: string,
  readingId: string,
): Promise<FortuneFeedbackChatSession | null> {
  const data = await readUserFortuneDataExport(userId);
  return data.feedback_chats?.[readingId] ?? null;
}

async function runAndSaveSession(params: {
  userId: string;
  reading: FortuneReading;
  locale: "en" | "zh";
  messages: FortuneFeedbackChatMessage[];
  isFirstTurn: boolean;
  isKickoff?: boolean;
  prevDraft?: FortuneFeedbackChatSession["draft"];
  allReadings: FortuneReading[];
}) {
  const data = await readUserFortuneDataExport(params.userId);
  const feedbackLearnings = formatFeedbackLearningsBlock(data.feedback_entries ?? [], params.locale);
  const profileNotes = data.profile?.notes?.trim() || null;

  const ai = await runFeedbackChatTurn({
    reading: params.reading,
    messages: params.messages,
    locale: params.locale,
    isFirstTurn: params.isFirstTurn,
    isKickoff: params.isKickoff,
    recentDailyReadings: params.allReadings,
    prevDraft: params.prevDraft,
    profileNotes,
    feedbackLearnings,
  });

  if (!ai.ok) {
    return { ok: false as const, error: mapFeedbackChatError(ai.error, params.locale) };
  }

  const assistantMsg: FortuneFeedbackChatMessage = {
    role: "assistant",
    content: ai.reply,
    created_at: new Date().toISOString(),
  };

  const session: FortuneFeedbackChatSession = {
    reading_id: params.reading.id,
    messages: [...params.messages, assistantMsg],
    draft: ai.draft,
    updated_at: assistantMsg.created_at,
  };

  const chats = { ...(data.feedback_chats ?? {}) };
  chats[params.reading.id] = session;
  data.feedback_chats = chats;
  await writeUserFortuneDataFull(params.userId, data);

  return { ok: true as const, session, reply: ai.reply };
}

export async function kickoffFeedbackChatAudit(params: {
  userId: string;
  reading: FortuneReading;
  locale: "en" | "zh";
}) {
  const data = await readUserFortuneDataExport(params.userId);
  const existing = data.feedback_chats?.[params.reading.id];
  if (existing?.messages?.length) {
    return { ok: true as const, session: existing, reply: null };
  }

  return runAndSaveSession({
    userId: params.userId,
    reading: params.reading,
    locale: params.locale,
    messages: [],
    isFirstTurn: true,
    isKickoff: true,
    allReadings: data.readings ?? [],
  });
}

export async function sendFeedbackChatMessage(params: {
  userId: string;
  reading: FortuneReading;
  message: string;
  locale: "en" | "zh";
}) {
  const text = params.message.trim();
  if (!text) {
    return { ok: false as const, error: "请输入内容" };
  }

  const data = await readUserFortuneDataExport(params.userId);
  const chats = { ...(data.feedback_chats ?? {}) };
  const existing = chats[params.reading.id];
  const now = new Date().toISOString();

  const userMsg: FortuneFeedbackChatMessage = {
    role: "user",
    content: text,
    created_at: now,
  };

  const history = [...(existing?.messages ?? []), userMsg];
  const userTurns = history.filter((m) => m.role === "user").length;

  return runAndSaveSession({
    userId: params.userId,
    reading: params.reading,
    locale: params.locale,
    messages: history,
    isFirstTurn: userTurns === 1,
    prevDraft: existing?.draft,
    allReadings: data.readings ?? [],
  });
}

export type { FortuneFeedbackRating };
