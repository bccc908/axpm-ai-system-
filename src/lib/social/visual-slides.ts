import type { SlideCardCopy } from "@/lib/ai/social-copy-prompt";
import { parseScriptToSlides } from "@/lib/social/parse-script";

export type VisualSlide =
  | { kind: "cover"; tag: string; headline: string; body: string }
  | { kind: "point"; tag: string; headline: string; body: string; index: number }
  | { kind: "outro"; tag: string; headline: string; body: string };

export function buildVisualSlides(params: {
  title: string;
  script: string;
  slideCards?: SlideCardCopy[];
}): VisualSlide[] {
  if (params.slideCards?.length) {
    const cards = params.slideCards;
    const cover = cards[0];
    const points = cards.slice(1, -1);
    const outro = cards[cards.length - 1];

    return [
      {
        kind: "cover",
        tag: cover.tag || "开场",
        headline: params.title.trim() || cover.headline,
        body: cover.body || cover.headline,
      },
      ...points.slice(0, 3).map((p, i) => ({
        kind: "point" as const,
        tag: p.tag || `要点 ${i + 1}`,
        headline: p.headline,
        body: p.body,
        index: i + 1,
      })),
      {
        kind: "outro",
        tag: outro?.tag || "结尾",
        headline: outro?.headline || "觉得有用就收藏",
        body: outro?.body || "评论区交流 · 仅供参考",
      },
    ];
  }

  return parseScriptToSlides({
    title: params.title,
    script: params.script,
  }).map((s) => {
    if (s.kind === "cover") {
      return { kind: "cover" as const, tag: "开场", headline: s.headline, body: s.subline };
    }
    if (s.kind === "point") {
      return {
        kind: "point" as const,
        tag: `要点 ${s.index}`,
        headline: s.text.slice(0, 16),
        body: s.text,
        index: s.index,
      };
    }
    return {
      kind: "outro" as const,
      tag: "结尾",
      headline: s.headline,
      body: s.subline,
    };
  });
}
