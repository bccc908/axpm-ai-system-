import type { FortuneFeedbackRating, FortuneReadingFeedback } from "@/types/fortune";

export type FortuneFeedbackStats = {
  total: number;
  accurate: number;
  partial: number;
  wrong: number;
  accuracyRate: number | null;
};

export function isRelevantForPrompt(entry: FortuneReadingFeedback): boolean {
  return (
    entry.rating !== "accurate" ||
    Boolean(entry.actual_outcome?.trim()) ||
    Boolean(entry.errors?.trim()) ||
    Boolean(entry.correction_notes?.trim())
  );
}

export function countFeedbackForPrompt(entries: FortuneReadingFeedback[], limit = 12): number {
  return entries.filter(isRelevantForPrompt).slice(0, limit).length;
}

export function computeFeedbackStats(entries: FortuneReadingFeedback[]): FortuneFeedbackStats {
  const total = entries.length;
  const accurate = entries.filter((e) => e.rating === "accurate").length;
  const partial = entries.filter((e) => e.rating === "partial").length;
  const wrong = entries.filter((e) => e.rating === "wrong").length;
  const accuracyRate = total > 0 ? Math.round((accurate / total) * 100) : null;
  return { total, accurate, partial, wrong, accuracyRate };
}

export function ratingLabel(rating: FortuneFeedbackRating, locale: "en" | "zh"): string {
  if (locale === "zh") {
    return rating === "accurate" ? "准" : rating === "partial" ? "部分准" : "不准";
  }
  return rating === "accurate" ? "Accurate" : rating === "partial" ? "Partly" : "Wrong";
}
