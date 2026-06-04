import "server-only";

import {
  VIDEO_SCRIPT_CHAR_MAX,
  VIDEO_SCRIPT_CHAR_MIN,
  VIDEO_HOOK_SECONDS,
  VIDEO_TARGET_SECONDS,
} from "@/lib/social/video-spec";

export type SocialCopyPlatform = "douyin" | "xiaohongshu" | "general";
export type SocialCopyStyle = "viral" | "pro" | "story";

export type SlideCardCopy = {
  tag: string;
  headline: string;
  body: string;
};

const STYLE_GUIDES: Record<SocialCopyStyle, string> = {
  viral: `Style: 抖音高完播口播 — 生动 + 专业感并存
- 开场像「抓耳朵」：提问/反差/数字，禁止「今天聊聊」
- 短句、有节奏，适合字幕，偶尔用口语词（「说白了」「真别」「划重点」）
- 每段要有画面感：「一笔反向波动」「截图不算数」「百倍以上先别碰」
- 用「你」对话，穿插「我见过/我当年」但别编故事
- 专业点：监管、杠杆、止损、滑点等术语要用对、讲清楚
- 结尾：具体问题引评论 + 收藏 + 一句免责`,
  pro: `Style: 专业财经博主 — 像 Bloomberg 中文短视频 + 人话
- 冷静权威，但不枯燥；每句都有信息增量
- 结构：误区 → 原理 → 实操底线
- 数字要具体（10倍、2%止损、1-3工作日）但不编造案例
- 结尾理性总结 + 免责`,
  story: `Style: 场景故事 — 30秒微型叙事
- 开头一个具体场景（「上周有人问我…」「朋友差点…」）不编造盈利
- 从故事抽1-2个可迁移的教训
- 口语、有张力，结尾问「你遇到过吗」`,
};

const DOUYIN_GOLD_EXAMPLE = `EXAMPLE (match vivid rhythm + pro credibility — new topic each time):

{
  "title": "500倍杠杆？新手先别碰",
  "script_zh": "你以为杠杆越大，赚得越快？\\n我刚开始也这么想过。\\n\\n结果呢？一次反向波动，学费交得够狠。\\n\\n说白了，杠杆不是加速器——是放大器。\\n放大你的对，也放大你的错。\\n\\n我给自己三条铁律：\\n· 百倍以上，新手别碰\\n· 每笔单，先写好最多亏多少\\n· 看不懂？空仓也是操作\\n\\n你第一次开几倍杠杆？评论区说说，我看看多少人同款踩坑。\\n\\n以上个人经验，仅供参考，投资有风险。",
  "content_zh": "杠杆不是越大越好｜新手最容易交的学费\\n#理财知识# #避坑指南# #外汇入门# #理性投资#",
  "slides_zh": [
    {"tag": "开场", "headline": "杠杆不是加速器", "body": "是放大器——放大对，也放大错"},
    {"tag": "坑 #1", "headline": "百倍以上别碰", "body": "波动1%可能就没了，新手从10倍以内开始"},
    {"tag": "坑 #2", "headline": "每笔先定止损", "body": "亏多少自己说了算，别扛单"},
    {"tag": "坑 #3", "headline": "看不懂就空仓", "body": "不操作，也是一种操作"},
    {"tag": "结尾", "headline": "觉得有用就收藏", "body": "评论区聊聊你的经历 · 仅供参考"}
  ],
  "content_en": ""
}`;

const PERSONAL_RULES = `PERSONAL ACCOUNT rules:
- First person 「我」, speak to 「你」
- NO company/brand names, NO broker promo, NO 稳赚/带单/喊单/私信开户
- BAN filler: 「作为过来人」「我必须告诉你」「今天分享」「众所周知」
- Must feel like a real creator: vivid, tight, credible — NOT textbook or AI template
- Title: hook with contrast/question/number — never copy topic verbatim`;

const JSON_FORMAT = `Return JSON only:
{
  "title": string,
  "script_zh": string,
  "narrations_zh": [string, string, string, string, string],
  "content_zh": string,
  "slides_zh": [
    {"tag": "4 chars max label", "headline": "8-16 chars punchy", "body": "12-28 chars detail"}
  ],
  "content_en": string
}

narrations_zh: EXACTLY 5 spoken segments — one per slide, fills the FULL 45s video:
  [0] 3s hook (~12-22 chars) — scroll-stopper, spoken fast
  [1-3] 12s each (~45-58 chars EACH) — substantive「我」口播 matching slides_zh[1-3], NO empty filler
  [4] 6s outro (~20-32 chars) — comment bait + brief 免责
script_zh = narrations_zh joined (no extra text outside narrations).

slides_zh: exactly 5 cards — 开场 + 3干货要点 + 结尾。headline要能上画面、有冲击力。
开场卡（slides_zh[0]）= 视频前${VIDEO_HOOK_SECONDS}秒钩子：headline必须「停划走」级别（反差/数字/提问），禁止温吞开场。`;

export function resolveSocialPlatform(platform?: string): SocialCopyPlatform {
  if (platform === "douyin") return "douyin";
  if (platform === "xiaohongshu") return "xiaohongshu";
  return "general";
}

export function buildAngleSystemPrompt(platform: SocialCopyPlatform, style: SocialCopyStyle) {
  return [
    "You are a top-tier Douyin strategist for finance education — viral hooks + professional accuracy.",
    PERSONAL_RULES,
    STYLE_GUIDES[style],
    "",
    "Return JSON:",
    `{ "hook_line": "", "contrarian_angle": "", "points": [{"headline":"","detail":"","visual":""}], "comment_bait": "", "title_hooks": ["", ""] }`,
    "Each point needs a visual phrase suitable for on-screen text (short, punchy).",
    `Platform: ${platform}`,
  ].join("\n");
}

export function buildWriterSystemPrompt(
  platform: SocialCopyPlatform,
  style: SocialCopyStyle,
  creatorBrief?: string,
) {
  const cloneBlock = creatorBrief?.trim()
    ? `CREATOR CLONE — mirror this person's voice, phrases, expertise, boundaries:\n${creatorBrief.trim().slice(0, 14_000)}`
    : "Write as one consistent personal creator (第一人称「我」) — same voice start to finish.";

  return [
    "You are an elite Chinese short-video scriptwriter — vivid like top creators, accurate like a pro advisor.",
    PERSONAL_RULES,
    cloneBlock,
    STYLE_GUIDES[style],
    "",
    DOUYIN_GOLD_EXAMPLE,
    "",
    JSON_FORMAT,
    `CRITICAL: Every narrations_zh segment must be DENSE oral speech — the viewer hears talking for ALL ${VIDEO_TARGET_SECONDS} seconds. Never write a short hook then silence.`,
    `script_zh: sum of narrations_zh (~${VIDEO_SCRIPT_CHAR_MIN}–${VIDEO_SCRIPT_CHAR_MAX} chars total).`,
  ].join("\n");
}

export function buildWriterUserMessage(params: {
  topic: string;
  locale: "en" | "zh" | "both";
  angle: Record<string, unknown>;
  hasCreatorTraining?: boolean;
}) {
  return [
    `Topic: ${params.topic}`,
    `Locale: ${params.locale}`,
    params.hasCreatorTraining
      ? "Use the creator training above — clone their tone, vocabulary, and expertise."
      : "No training files yet — still write vivid first-person「我」through all 5 narrations_zh segments.",
    "Angle brief:",
    JSON.stringify(params.angle, null, 2),
    "narrations_zh[1-3] must each carry ~12 seconds of real talk matching the slide. No dead air after the hook.",
  ].join("\n");
}

export function buildAngleUserMessage(topic: string) {
  return `Topic: ${topic}\nFind a scroll-stopping angle with 3 concrete, non-generic insights. Each point needs a visual headline for on-screen text.`;
}

const AI_CLICHE =
  /作为过来人|我必须告诉你|今天(我们)?来(聊|分享)|在这个(时代|社会)|众所周知|首先其次最后|第一[,，、]|第二[,，、]|第三[,，、]/g;

export function polishSocialCopy(text: string): string {
  let t = text
    .replace(AI_CLICHE, (match) => {
      if (match.startsWith("第一")) return "先说";
      if (match.startsWith("第二")) return "更坑的是";
      if (match.startsWith("第三")) return "划重点";
      return "";
    })
    .replace(/。\s*。\s*/g, "。")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!t.includes("风险") && !t.includes("仅供参考")) {
    t += "\n\n以上个人经验，仅供参考，投资有风险。";
  }
  return t;
}

export function parseNarrationsZh(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const lines = raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return lines.length >= 3 ? lines.slice(0, 5) : undefined;
}

export function parseSlideCards(raw: unknown): SlideCardCopy[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cards = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const headline = String(o.headline ?? "").trim();
      const body = String(o.body ?? "").trim();
      const tag = String(o.tag ?? "").trim() || "要点";
      if (!headline) return null;
      return { tag, headline, body: body || headline };
    })
    .filter(Boolean) as SlideCardCopy[];
  return cards.length >= 3 ? cards.slice(0, 5) : undefined;
}

export function sanitizeSocialDraft(draft: Record<string, unknown>) {
  const strip = (text: string) =>
    text
      .replace(/\bAXPM\b/gi, "")
      .replace(/AXPM[团队|官方|公司]*/g, "")
      .replace(/我们团队/g, "我")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const out: Record<string, unknown> = {};
  for (const key of ["title", "script_zh", "content_zh", "content_en", "content"]) {
    const val = draft[key];
    if (typeof val === "string" && val.trim()) {
      out[key] = key === "script_zh" ? polishSocialCopy(strip(val)) : strip(val);
    }
  }

  const slides = parseSlideCards(draft.slides_zh);
  if (slides) out.slides_zh = slides;

  const narrations = parseNarrationsZh(draft.narrations_zh);
  if (narrations?.length) {
    out.narrations_zh = narrations;
    out.script_zh = polishSocialCopy(strip(narrations.join("")));
  }

  if (!out.script_zh && out.content_zh) out.script_zh = polishSocialCopy(String(out.content_zh));
  if (!out.content_zh && out.script_zh) {
    out.content_zh = `${out.title || "干货分享"}\n#理财知识# #避坑指南# #理性投资#`;
  }
  return out as Record<string, string> & {
    slides_zh?: SlideCardCopy[];
    narrations_zh?: string[];
  };
}
