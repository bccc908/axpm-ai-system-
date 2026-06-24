import { describe, expect, it } from "vitest";
import {
  computeFeedbackStats,
  countFeedbackForPrompt,
  isRelevantForPrompt,
} from "@/lib/fortune/feedback-stats";
import type { FortuneReadingFeedback } from "@/types/fortune";

function entry(
  partial: Partial<FortuneReadingFeedback> & Pick<FortuneReadingFeedback, "rating">,
): FortuneReadingFeedback {
  return {
    id: "1",
    reading_id: "r1",
    reading_title: "Test",
    topic: "daily",
    fortune_date: "2026-06-17",
    actual_outcome: null,
    errors: null,
    correction_notes: null,
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
    ...partial,
  };
}

describe("feedback-stats", () => {
  it("counts relevant entries for prompt injection", () => {
    const entries = [
      entry({ rating: "accurate" }),
      entry({ rating: "wrong", errors: "said signing day" }),
      entry({ rating: "partial", actual_outcome: "no deal" }),
    ];
    expect(countFeedbackForPrompt(entries)).toBe(2);
    expect(isRelevantForPrompt(entries[0])).toBe(false);
    expect(isRelevantForPrompt(entries[1])).toBe(true);
  });

  it("computes accuracy rate", () => {
    const stats = computeFeedbackStats([
      entry({ rating: "accurate" }),
      entry({ rating: "accurate" }),
      entry({ rating: "wrong" }),
    ]);
    expect(stats.total).toBe(3);
    expect(stats.accurate).toBe(2);
    expect(stats.wrong).toBe(1);
    expect(stats.accuracyRate).toBe(67);
  });
});
