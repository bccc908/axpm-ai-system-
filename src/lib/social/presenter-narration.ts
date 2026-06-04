import type { SlideCardCopy } from "@/lib/ai/social-copy-prompt";
import { parseNarrationsZh } from "@/lib/ai/social-copy-prompt";
import {
  slideTimingsForCount,
  VIDEO_TARGET_SECONDS,
} from "@/lib/social/video-spec";

/** Spoken Chinese ~4 chars/sec — per-slide narration length floors */
export const NARRATION_CHAR_MIN = [12, 42, 42, 42, 18];

export type SlideNarration = {
  text: string;
  seconds: number;
};

function splitScriptSentences(script: string) {
  return script
    .replace(/\n+/g, " ")
    .split(/(?<=[。！？!?])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function expandNarration(text: string, slide: SlideCardCopy | undefined, minChars: number) {
  let t = text.trim();
  if (t.length >= minChars) return t;
  if (!slide) return t.padEnd(minChars, "。").slice(0, minChars + 8);
  const extra = `${slide.headline}，${slide.body}`;
  if (!t) t = extra;
  else if (!t.includes(slide.headline.slice(0, 4))) t = `${t.replace(/[。！？!?]$/, "")}，${extra}`;
  while (t.length < minChars && t.length < 120) t += "。";
  return t;
}

/** Build 5 timed narrations aligned to slide durations — never leave a segment empty */
export function buildSlideNarrations(params: {
  script: string;
  slideCards?: SlideCardCopy[];
  narrationsZh?: string[];
  slideCount?: number;
}): SlideNarration[] {
  const count = params.slideCount ?? params.slideCards?.length ?? 5;
  const timings = slideTimingsForCount(count);
  const mins = NARRATION_CHAR_MIN.slice(0, count);
  while (mins.length < count) mins.push(36);

  const cards = params.slideCards ?? [];
  let parts = params.narrationsZh?.slice(0, count);

  if (!parts || parts.length < count) {
    const sentences = splitScriptSentences(params.script);
    parts = Array.from({ length: count }, () => "");
    if (sentences.length >= count) {
      const per = Math.ceil(sentences.length / count);
      for (let i = 0; i < count; i++) {
        parts[i] = sentences.slice(i * per, (i + 1) * per).join("");
      }
    } else if (sentences.length > 0) {
      parts[0] = sentences[0] ?? "";
      for (let i = 1; i < count - 1 && i - 1 < sentences.length - 1; i++) {
        parts[i] = sentences[i] ?? "";
      }
      parts[count - 1] = sentences[sentences.length - 1] ?? "";
    }
  }

  return timings.map((seconds, i) => ({
    seconds,
    text: expandNarration(parts[i] ?? "", cards[i], mins[i] ?? 36),
  }));
}

export function scriptFromNarrations(narrations: SlideNarration[]) {
  return narrations.map((n) => n.text).join("");
}

export function totalNarrationSeconds(narrations: SlideNarration[]) {
  return narrations.reduce((sum, n) => sum + n.seconds, 0);
}

export function assertFullVideoCoverage(narrations: SlideNarration[]) {
  const total = totalNarrationSeconds(narrations);
  if (Math.abs(total - VIDEO_TARGET_SECONDS) > 0.05) {
    throw new Error(`Narration timing mismatch: ${total}s vs ${VIDEO_TARGET_SECONDS}s`);
  }
  const empty = narrations.find((n) => n.text.replace(/\s/g, "").length < 8);
  if (empty) throw new Error("A video segment has no narration text");
}
