import "server-only";

import { randomUUID } from "crypto";
import type {
  FortuneFeedbackRating,
  FortuneReading,
  FortuneReadingFeedback,
  FortuneTopic,
} from "@/types/fortune";
import {
  readUserFortuneDataExport,
  writeUserFortuneDataFull,
} from "@/lib/fortune/user-store";

const MAX_FEEDBACK = 200;

export type FortuneFeedbackInput = {
  reading_id: string;
  rating: FortuneFeedbackRating;
  actual_outcome?: string | null;
  errors?: string | null;
  correction_notes?: string | null;
  chat_messages?: import("@/types/fortune").FortuneFeedbackChatMessage[];
};

export async function getFortuneFeedbackByReadingId(
  userId: string,
  readingId: string,
): Promise<FortuneReadingFeedback | null> {
  const data = await readUserFortuneDataExport(userId);
  return (data.feedback_entries ?? []).find((f) => f.reading_id === readingId) ?? null;
}

export async function listFortuneFeedbackEntries(userId: string, limit = 50) {
  const data = await readUserFortuneDataExport(userId);
  return [...(data.feedback_entries ?? [])]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, limit);
}

export async function upsertFortuneFeedback(
  userId: string,
  input: FortuneFeedbackInput,
  reading: FortuneReading,
): Promise<FortuneReadingFeedback> {
  const data = await readUserFortuneDataExport(userId);
  const entries = [...(data.feedback_entries ?? [])];
  const now = new Date().toISOString();
  const existing = entries.find((f) => f.reading_id === input.reading_id);

  const row: FortuneReadingFeedback = existing
    ? {
        ...existing,
        rating: input.rating,
        actual_outcome: input.actual_outcome?.trim() || null,
        errors: input.errors?.trim() || null,
        correction_notes: input.correction_notes?.trim() || null,
        chat_messages: input.chat_messages ?? existing.chat_messages,
        updated_at: now,
      }
    : {
        id: randomUUID(),
        reading_id: input.reading_id,
        reading_title: reading.title,
        topic: reading.topic,
        fortune_date: reading.fortune_date ?? null,
        rating: input.rating,
        actual_outcome: input.actual_outcome?.trim() || null,
        errors: input.errors?.trim() || null,
        correction_notes: input.correction_notes?.trim() || null,
        chat_messages: input.chat_messages,
        created_at: now,
        updated_at: now,
      };

  const next = existing
    ? entries.map((f) => (f.reading_id === input.reading_id ? row : f))
    : [row, ...entries];

  data.feedback_entries = next.slice(0, MAX_FEEDBACK);
  await writeUserFortuneDataFull(userId, data);
  return row;
}

export function formatFeedbackLearningsBlock(
  entries: FortuneReadingFeedback[],
  locale: "en" | "zh",
): string | null {
  const relevant = entries
    .filter(
      (e) =>
        e.rating !== "accurate" ||
        e.actual_outcome?.trim() ||
        e.errors?.trim() ||
        e.correction_notes?.trim(),
    )
    .slice(0, 12);

  if (relevant.length === 0) return null;

  if (locale === "zh") {
    return [
      "【用户每日复盘 — 必须据此校准，避免重复同样偏差】",
      ...relevant.map((e, i) => {
        const date = e.fortune_date ?? e.updated_at.slice(0, 10);
        const rating =
          e.rating === "accurate" ? "准" : e.rating === "partial" ? "部分准" : "不准";
        const parts = [
          `${i + 1}. ${date} [${e.topic}] ${rating} —「${e.reading_title.slice(0, 40)}」`,
        ];
        if (e.actual_outcome) parts.push(`   实际：${e.actual_outcome.slice(0, 200)}`);
        if (e.errors) parts.push(`   说错/偏差：${e.errors.slice(0, 200)}`);
        if (e.correction_notes) parts.push(`   以后应：${e.correction_notes.slice(0, 200)}`);
        return parts.join("\n");
      }),
      "要求：本次解读主动对照以上复盘，修正方向、节奏与项目判断。",
    ].join("\n");
  }

  return [
    "[User daily review — calibrate using this, avoid repeating mistakes]",
    ...relevant.map((e, i) => {
      const date = e.fortune_date ?? e.updated_at.slice(0, 10);
      const rating =
        e.rating === "accurate" ? "accurate" : e.rating === "partial" ? "partial" : "wrong";
      const parts = [`${i + 1}. ${date} [${e.topic}] ${rating} — "${e.reading_title.slice(0, 40)}"`];
      if (e.actual_outcome) parts.push(`   Actual: ${e.actual_outcome.slice(0, 200)}`);
      if (e.errors) parts.push(`   Errors: ${e.errors.slice(0, 200)}`);
      if (e.correction_notes) parts.push(`   Next time: ${e.correction_notes.slice(0, 200)}`);
      return parts.join("\n");
    }),
    "Requirement: actively adjust this reading based on the review above.",
  ].join("\n");
}

export async function getFortuneFeedbackForPrompt(userId: string, locale: "en" | "zh") {
  const entries = await listFortuneFeedbackEntries(userId, 20);
  return formatFeedbackLearningsBlock(entries, locale);
}

export type { FortuneTopic };
