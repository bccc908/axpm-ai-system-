import "server-only";

import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { isDeepSeekConfigured } from "@/lib/ai/deepseek-config";
import type { FortuneLuckyElements, FortuneProfile, FortuneReading, FortuneTopic } from "@/types/fortune";
import { ensureDailyReadingDate, getFortuneDateLabel, getFortuneTodayKey, getDailyHexagramMoment } from "@/lib/fortune/date";
import { buildCustomerSystemPrompt, buildCustomerUserPrompt } from "@/lib/fortune/customer-prompts";
import {
  formatFortuneSystemsBlock,
  getChineseZodiac,
  getFortuneSystems,
} from "@/lib/fortune/systems";
import { fortuneAdvisorPersonaBlock } from "@/lib/fortune/advisor-persona";
import { formatDailyHexagramBlock, getMeihuaHexagram, getContextualHexagramHint, getHexagramCoreTagline } from "@/lib/fortune/hexagram";
import { buildDailyAntiRepeatBlock } from "@/lib/fortune/daily-anti-repeat";
import { sanitizeDailyReadingMarkdown, sanitizeDailySummary } from "@/lib/fortune/daily-sanitize";
import { formatWeekdayContextBlock, getWeekdayProfile } from "@/lib/fortune/weekday-context";
import { isLegacyDailyReading } from "@/lib/fortune/daily-format";
import {
  buildPrioritySection,
  dailyBusinessPersonaZh,
  dailyBusinessStructureGuide,
  rotateBusinessPriorities,
} from "@/lib/fortune/daily-business";

export { getChineseZodiac } from "@/lib/fortune/systems";

const topicLabels: Record<FortuneTopic, { en: string; zh: string }> = {
  daily: { en: "Today's fortune", zh: "今日运势" },
  career: { en: "Career & work", zh: "事业运" },
  wealth: { en: "Wealth & money", zh: "财运" },
  love: { en: "Love & relationships", zh: "感情运" },
  general: { en: "General life path", zh: "综合运势" },
  astro: { en: "Western astrology", zh: "星座运势" },
  tarot: { en: "Tarot reading", zh: "塔罗占卜" },
  numerology: { en: "Numerology", zh: "数字命理" },
  ziwei: { en: "Zi Wei Dou Shu", zh: "紫微斗数" },
  meihua: { en: "Plum Blossom I Ching", zh: "梅花易数" },
  yijing: { en: "I Ching", zh: "易经" },
  chenggu: { en: "Bone weight fortune", zh: "称骨算命" },
  mianxiang: { en: "Chinese physiognomy", zh: "面相分析" },
  combined: { en: "Multi-system synthesis", zh: "多维综合" },
  custom: { en: "Personal question", zh: "个人问事" },
};

export function buildSystemPrompt(locale: "en" | "zh", topic: FortuneTopic) {
  if (locale === "zh") {
    const base = [
      fortuneAdvisorPersonaBlock("zh"),
      "你是 Kayden 的私人命理顾问，风格须接近他长期在 ChatGPT 使用的「数字命理 + 八字 + 梅花易数意象卦」深度解读。",
      "读者背景（务必融入分析，不要忽略）：",
      "- 八字：甲戌年 · 丙寅月 · 辛未日 · 癸巳时；生肖狗",
      "- 数字能量：1 / 3 / 6 / 9 偏旺；缺 5 · 7 · 8（易急、难休息、守财是课题）",
      "- 命格关键词：创业型、会做局、大市场/中国运、大起大落型财运",
      "- 2026 当前重心：济南团队、ICCI×济南合作、AXPM 平台；策略是抓关键人、借力贵人、分批清债、不必到处跑",
      "- 忌讳：情绪赌博、高杠杆硬拼、同时开太多战线",
      "",
      "写作要求（非常重要）：",
      "1. 内容要「细」——有结构、有层次、有具体场景，禁止空泛鸡汤（如只说「保持积极」）",
      "2. 每个判断都要落到「今天/本周可以怎么做」",
      "3. 用 ★ 星级评分（1-5 星，可半星如 ★★★★☆）",
      "4. 用 ✅ 适合 / ❌ 不宜 列出行动清单",
      "5. 结合他的三个项目分别给 1-2 句可执行建议",
      "6. 必须结合出生时辰（如癸巳时）× 今日流时，写清「此时辰宜做 / 此时辰宜避」——具体做什么事、回避什么事",
      "7. 语气：像懂他的老朋友，直接、有温度，可点破压力与盲点",
      "8. reading 用 Markdown（## 小标题），今日运势约 500–700 字，其他主题约 400–600 字，结构完整即可",
      "9. 仅供娱乐与个人反思，非医疗/法律/投资建议",
      "10. 只输出合法 JSON，不要 markdown 代码块包裹",
    ];

    if (topic === "daily") {
      base.splice(0, 2, dailyBusinessPersonaZh());
      base.splice(
        10,
        8,
        "3. 星级用 ⭐（1-5，可半星），禁止 ★ 或 x/10",
        "4. P0/P1/P2 业务线必须写清目标、今日动作、完成标准",
        "5. ✅ / ❌ 行动清单动词开头，可验收",
        "6. 禁止时辰模板；卦象只在「态势研判」作决策框架",
        "7. 语气：高管顾问，简洁、直接、可执行",
        "8. reading 用 Markdown（## / ###），450–650 字",
        "9. 仅供个人决策参考，非医疗/法律/投资建议",
        "10. 只输出合法 JSON，不要 markdown 代码块包裹",
      );
      base.push(
        "",
        "每日决策简报规范：",
        "- 07:30 HKT 起念得卦 → 写入「态势研判」作决策框架，勿写成算命开篇",
        "- 执行摘要 = 董事会一页纸结论；summary 字段与之呼应",
        "- 三线业务（济南 / ICCI / AXPM）用 P0/P1/P2 排优先级，每日轮换主轴",
        "- 分项评估：事业推进、资金与现金流、人脉与资源",
        "- 决策锚点 = 今日拍板时回到的一句话",
        "- 禁止综合指数、感情运大段、紫微/称骨长文堆砌",
        "",
        "反同质化：",
        "- 禁止复制近日简报句式；P0 项目每日轮换",
        "- 资金段勿总写「非今日落袋」；结合 AXPM/回款/债务真实语境",
        "- lucky.keyword 用商业词（如：聚焦、对齐、风控）",
      );
    }

    if (topic === "astro") {
      base.push(
        "",
        "星座运势要求：",
        "- 以太阳星座为主，结合当下行运（不必精确星历，用象征语言）",
        "- 含：性格底色、本周/今日能量、事业/感情/财运、与东方命理的呼应",
      );
    }

    if (topic === "tarot") {
      base.push(
        "",
        "塔罗要求：",
        "- 根据出生信息与今日日期「象征性」抽取 3 张牌（过去/现在/建议 或 现状/挑战/指引）",
        "- 每张牌：牌名（中英文）+ 正/逆位 + 具体解读，最后给统一结论",
      );
    }

    if (topic === "numerology") {
      base.push(
        "",
        "数字命理要求：",
        "- 生命灵数 + 1/3/6/9 旺与缺 5/7/8 的分析",
        "- 含：性格模式、当下周期、事业/财运/情绪课题、补数建议（颜色/数字/行为）",
      );
    }

    if (topic === "ziwei") {
      base.push(
        "",
        "紫微斗数要求：",
        "- 依据出生年月日时（含时辰）排盘意象：命宫、身宫、主星（如紫微、天府、七杀等）",
        "- 含：命格总论、大限/流年趋势、事业/财帛/夫妻/迁移等宫位要点",
        "- 结合 Kayden 创业型、大起大落财运、2026 济南/ICCI/AXPM 重心",
      );
    }

    if (topic === "meihua") {
      base.push(
        "",
        "梅花易数要求：",
        "- 说明起卦依据（时间/数字/意象），给出本卦、互卦、变卦（如有）",
        "- 卦象拆解到具体场景：事业、财运、贵人、心态",
        "- 给一句梅花卦语 + ✅❌ 行动建议",
      );
    }

    if (topic === "yijing") {
      base.push(
        "",
        "易经要求：",
        "- 以《周易》六十四卦体系解读：卦名、卦辞/象辞要义、六爻动静（可抓重点爻）",
        "- 联系当下决策：进退、合作、守成、变革",
        "- 含：卦义总论、事业/财运/人际、趋吉避凶、一句易经箴言",
      );
    }

    if (topic === "chenggu") {
      base.push(
        "",
        "称骨算命要求：",
        "- 必须引用用户档案中已算好的骨重与歌诀，在此基础上深度展开",
        "- 含：骨重判词、性格命运、事业财运、感情、健康心态、改运建议",
        "- 与八字、数字能量交叉验证",
      );
    }

    if (topic === "mianxiang") {
      base.push(
        "",
        "面相分析要求：",
        "- 以传统面相学（三停、五官、十二宫、气色）解读，结合出生时辰与生肖",
        "- 必须结合档案中的易经卦象（梅花易数）与奇门遁甲（时家奇门门星神方位）交叉验证",
        "- 面相宫位（额眉眼鼻口）与卦象、奇门门星须互相印证，指出一致与矛盾",
        "- 若用户在问题中描述了五官/脸型/痣/气色，必须逐条对应分析",
        "- 若未描述相貌，则据照片可见特征解读，禁止编造看不清的细节",
        "- 含：## 面相总论 ## 五官要点 ## 易经卦象 ## 奇门遁甲 ## 运势宫位 ## 改运建议",
      );
    }

    if (topic === "combined") {
      base.push(
        "",
        "多维综合要求（最重要）：",
        "- 必须分别解读：八字、称骨、紫微斗数、梅花易数、易经卦象、生肖、星座、数字能量、塔罗三省",
        "- 各体系先独立给 ★ 评分，再做「交叉验证」——指出一致与矛盾之处",
        "- 最后输出「统一结论」：综合指数、一句总卦语、✅❌ 行动清单（结合三件事）",
        "- 禁止只写其中一个体系；这是全维度汇总",
      );
    }

    if (topic === "custom") {
      base.push(
        "",
        "问事要求：",
        "- 用户提出了具体问题，必须直接、明确地回答（先给结论，再展开）",
        "- 可综合运用八字、称骨、卦象、数字等，但全程围绕该问题",
        "- 含：问题重述、核心结论、依据分析、✅建议 / ❌忌讳、一句箴言",
      );
    }

    return base.join("\n");
  }

  const base = [
    fortuneAdvisorPersonaBlock("en"),
    "You are Kayden's personal fortune advisor — deep, structured, actionable (Eastern symbolism + practical strategy).",
    "Context: Dog zodiac; strong digits 1/3/6/9; lacks 5/7/8; entrepreneur profile; focus: Jinan team, ICCI partnership, AXPM platform.",
    "Write with clear sections, star ratings (★★★★☆), ✅ do / ❌ avoid lists, project-specific advice. No vague platitudes.",
    "reading: Markdown sections, min 500 words (daily min 800). JSON only, no code fences. Entertainment/reflection only.",
  ];

  if (topic === "daily") {
    base.push("Daily: include symbolic hexagram name, career/wealth/network/mood sections, one-line motto, score x/10.");
  }
  if (topic === "astro") {
    base.push("Western sun sign reading with practical career/love/wealth sections.");
  }
  if (topic === "tarot") {
    base.push("Draw 3 symbolic tarot cards with names, orientation, and unified conclusion.");
  }
  if (topic === "numerology") {
    base.push("Life path + personal digit pattern (strong 1/3/6/9, lacks 5/7/8) with remedies.");
  }
  if (topic === "ziwei") {
    base.push("Zi Wei chart themes: life/body palace, major stars, palaces for career/wealth/relationships.");
  }
  if (topic === "meihua") {
    base.push("Plum Blossom hexagrams: base/mutual/changed — applied to career, wealth, allies.");
  }
  if (topic === "yijing") {
    base.push("I Ching hexagram reading with judgment/image lines and practical guidance.");
  }
  if (topic === "chenggu") {
    base.push("Expand the provided bone-weight verse into full life/career/wealth guidance.");
  }
  if (topic === "mianxiang") {
    base.push(
      "Chinese physiognomy: upper/middle/lower face, five features, complexion; link to career/wealth/relationships; practical grooming/lifestyle tips.",
    );
  }
  if (topic === "combined") {
    base.push(
      "Synthesize ALL systems: Bazi, bone weight, Zi Wei, Meihua, I Ching, zodiac, Western sign, numerology, tarot — compare scores, unified action list.",
    );
  }

  return base.join("\n");
}

const hourStructureZh = [
  "## 时辰能量",
  "（命格时辰 × 今日流时：五行、互动、对今日整体的影响）",
  "## 此时辰宜做",
  "（✅ 3–5 条：具体做什么事、什么时段做；仅当与今日主轴相关时提项目名）",
  "## 此时辰宜避",
  "（❌ 3–5 条：具体回避什么事、什么心态/行为）",
].join("\n");

function getDailyVarietyGuide(locale: "en" | "zh", date = new Date()) {
  const key = getFortuneTodayKey(date);
  const dayNum = Number.parseInt(key.slice(8), 10) || 1;
  const weekdayProfile = getWeekdayProfile(date, locale);
  const weekday = weekdayProfile.weekdayEn;

  const leadStyles = [
    "执行摘要以「今日 P0 项目 + 一句话目标」开篇",
    "执行摘要以「最大风险 + 应对」开篇",
    "执行摘要以「资源/节奏判断」开篇",
    "执行摘要以「本周里程碑」反推今日动作开篇",
  ];
  const leadSystems = [
    "态势研判主线：卦象决策框架",
    "态势研判主线：执行节奏与内部协调",
    "态势研判主线：现金流与回款预期",
    "态势研判主线：团队授权与合规边界",
  ];
  const starProjects = ["济南团队", "ICCI×济南合作", "AXPM 平台"];
  const focusProject = starProjects[dayNum % 3];
  const briefProject = starProjects[(dayNum + 1) % 3];

  if (locale === "zh") {
    return [
      "【今日差异化指令 — 必须遵守】",
      `- 日期：${key}（${weekdayProfile.weekdayZh}）`,
      `- 开篇风格：${leadStyles[dayNum % leadStyles.length]}`,
      `- 今日命理主线：${leadSystems[dayNum % leadSystems.length]}（其他体系点到为止）`,
      `- 今日 P0 项目（写深）：${focusProject}`,
      `- P1 简要：${briefProject}`,
      `- P2：一句或并入风险段`,
      "- 禁止复制最近运势里出现过的句子和结构顺序",
      "",
      formatWeekdayContextBlock(weekdayProfile, locale),
    ].join("\n");
  }

  return [
    `[Daily variety] ${key} (${weekday})`,
    `Lead: ${leadStyles[dayNum % leadStyles.length]}`,
    `Focus system: ${leadSystems[dayNum % leadSystems.length]}`,
    `Deep dive project: ${focusProject}`,
    "",
    formatWeekdayContextBlock(weekdayProfile, locale),
  ].join("\n");
}

export function topicStructureGuide(topic: FortuneTopic, locale: "en" | "zh"): string {
  if (locale === "zh") {
    const guides: Record<FortuneTopic, string> = {
      daily: dailyBusinessStructureGuide("zh"),
      career: [
        "重点：济南团队推进、合作谈判、平台与团队授权。",
        "含：现状诊断、本周关键节点、贵人/阻力。",
        hourStructureZh,
        "含：✅❌ 行动清单、一句座右铭。",
      ].join("\n"),
      wealth: [
        "重点：大起大落型财运、现金流、分批清债、六月回款节奏。",
        "含：财运势 ★、回款/支出策略、债务处理顺序、风险提醒、✅❌ 清单。",
      ].join("\n"),
      love: [
        "重点：缺7的情绪模式、表面强内心累、感情与社交平衡。",
        "含：感情运 ★、单身/关系状态、沟通建议、✅❌ 清单。",
      ].join("\n"),
      general: [
        "综合：数字能量 + 八字 + 2026-2027 转折期 + 人生课题（守财、系统化、团队）。",
        "含：命格总论、优势/缺口、未来 3-6 个月方向、最旺行业、最忌行为。",
      ].join("\n"),
      astro: [
        "结构：",
        "## 星座底色",
        "## 当下行运能量",
        "## 事业 ★x/5",
        "## 财运 ★x/5",
        "## 感情 ★x/5",
        "## 与八字/数字的呼应",
        "## 本周/今日建议（✅❌）",
      ].join("\n"),
      tarot: [
        "结构：",
        "## 牌阵说明（3 张）",
        "## 牌一 · 现状/过去",
        "## 牌二 · 挑战/现在",
        "## 牌三 · 指引/建议",
        "## 牌义综合",
        "## 结合你的三件事",
        "## 一句塔罗箴言",
      ].join("\n"),
      numerology: [
        "结构：",
        "## 生命灵数解读",
        "## 1/3/6/9 旺 · 缺 5/7/8",
        "## 事业与财运模式 ★",
        "## 情绪与休息课题",
        "## 补运建议（数字/颜色/行为）",
        "## ✅❌ 清单",
      ].join("\n"),
      ziwei: [
        "结构：",
        "## 排盘概要（命宫 · 身宫 · 主星）",
        "## 命格总论",
        "## 事业宫 / 财帛宫 ★",
        "## 迁移 · 贵人 ★",
        "## 感情 / 心态 ★",
        "## 2026 大限与流年要点",
        "## ✅❌ 清单",
      ].join("\n"),
      meihua: [
        "结构：",
        "## 起卦说明",
        "## 本卦 · 卦象要义",
        "## 互卦 / 变卦（如有）",
        "## 事业 ★ · 财运 ★ · 贵人 ★",
        "## 结合你的三件事",
        "## 梅花卦语",
        "## ✅❌ 清单",
      ].join("\n"),
      yijing: [
        "结构：",
        "## 所得卦象（六十四卦之一）",
        "## 卦辞 / 象辞要义",
        "## 重点爻辞与启示",
        "## 事业 · 财运 · 人际",
        "## 趋吉避凶",
        "## 易经箴言",
      ].join("\n"),
      chenggu: [
        "结构：",
        "## 称骨骨重与歌诀",
        "## 命格判词",
        "## 事业财运 ★",
        "## 感情与人际 ★",
        "## 健康与心态",
        "## 改运建议",
        "## ✅❌ 清单",
      ].join("\n"),
      mianxiang: [
        "结构（必须逐项写，禁止空泛模板）：",
        "## 面相总论（三停气质 + 一句话总判）",
        "## 五官要点（必须逐条写：额头、眉、眼、鼻、口、下巴 — 引用照片观察）",
        "## 易经卦象（卦名、卦义、事业财运人际、趋吉避凶、箴言）",
        "## 奇门遁甲（门星神、方位、宜做宜避）",
        "## 运势宫位（事业 ★ / 财运 ★ / 感情 ★）",
        "## 改运建议（仪容作息心态，非医疗）",
        "## ✅❌ 行动清单",
        "## 一句面相箴言",
      ].join("\n"),
      combined: [
        "reading 必须按以下结构（用 ## 标题）：",
        "## 多维概览（一句话总判）",
        "## 八字要点",
        hourStructureZh,
        "## 称骨算命",
        "## 紫微斗数 ★x/5",
        "## 梅花易数卦象",
        "## 易经卦象",
        "## 生肖运势 ★x/5",
        "## 星座运势 ★x/5",
        "## 数字能量 ★x/5",
        "## 塔罗三省（牌名+解读）",
        "## 各体系对照表（一致 ✅ / 矛盾 ⚠️）",
        "## 统一结论",
        "## 结合你的三件事（各 1-2 句）",
        "## 综合行动清单（✅ 适合 / ❌ 不宜）",
        "## 综合指数（x/10 + 吉凶词）",
        "## 一句总卦语",
      ].join("\n"),
      custom: [
        "结构（围绕用户问题）：",
        "## 你的问题",
        "## 核心结论（先答是/否/宜/不宜，再解释）",
        hourStructureZh,
        "## 命理依据（八字/卦象/数字等）",
        "## 具体建议 ★",
        "## ✅ 适合 / ❌ 不宜",
        "## 一句箴言",
      ].join("\n"),
    };
    return guides[topic];
  }

  const guides: Record<FortuneTopic, string> = {
    daily: dailyBusinessStructureGuide("en"),
    career: "Jinan team, partnerships, delegation — structured with ★ and ✅❌.",
    wealth: "Cash flow, debt payoff phases, risk control — structured with ★ and ✅❌.",
    love: "Emotional patterns, relationships — structured with ★ and ✅❌.",
    general: "Life path, 2026-2027 transition, strengths/gaps, direction.",
    astro: "Sun sign sections with ★ ratings and Eastern cross-reference.",
    tarot: "3-card spread with names, orientation, synthesis.",
    numerology: "Life path, digit pattern, remedies, ✅❌.",
    ziwei: "Zi Wei palaces and major stars with ★ ratings.",
    meihua: "Plum Blossom hexagram spread with practical advice.",
    yijing: "I Ching hexagram with lines and guidance.",
    chenggu: "Bone weight verse expanded into life guidance.",
    mianxiang: "Physiognomy: three zones, five features, complexion, face palaces with ★ ratings.",
    combined:
      "All systems: Bazi, bone weight, Zi Wei, Meihua, I Ching, zodiac, astro, numerology, tarot — comparison + unified score.",
    custom: "Answer the question deeply with structure, ★ ratings, ✅❌.",
  };
  return guides[topic];
}

function formatRecentReadingsBlock(
  recent: Array<{
    topic: string;
    title: string;
    summary: string | null;
    fortune_date?: string | null;
    question?: string | null;
    reading?: string;
    lucky?: { color: string | null; number: string | null; keyword: string | null } | null;
  }>,
  locale: "en" | "zh",
  topic?: FortuneTopic,
) {
  if (recent.length === 0) return null;

  if (topic === "daily") {
    const snapshots = recent
      .filter((r) => r.topic === "daily" && r.reading)
      .map((r) => ({
        title: r.title,
        summary: r.summary,
        reading: r.reading!,
        fortune_date: r.fortune_date,
        lucky: r.lucky ?? null,
      }));
    const antiRepeat = buildDailyAntiRepeatBlock(snapshots, locale);
    if (antiRepeat) return antiRepeat;
  }

  if (locale === "zh") {
    return [
      "【近期已生成解读 — 勿重复相同卦语/结构/幸运数字】",
      ...recent.map(
        (r, i) =>
          `${i + 1}. [${r.topic}] ${r.title}${r.summary ? ` — ${r.summary.slice(0, 80)}` : ""}`,
      ),
    ].join("\n");
  }
  return [
    "[Recent readings — avoid repeating mottos, structure, lucky numbers]",
    ...recent.map((r, i) => `${i + 1}. [${r.topic}] ${r.title}`),
  ].join("\n");
}

function buildUserPrompt(input: {
  topic: FortuneTopic;
  question?: string | null;
  profile: FortuneProfile;
  locale: "en" | "zh";
  zodiac: string | null;
  contextReading?: FortuneReading | null;
  recentReadings?: Array<{
    topic: string;
    title: string;
    summary: string | null;
    fortune_date?: string | null;
    question?: string | null;
    reading?: string;
    lucky?: { color: string | null; number: string | null; keyword: string | null } | null;
  }>;
  feedbackLearnings?: string | null;
  hexDate?: Date;
}) {
  const hexMoment =
    input.topic === "daily" ? (input.hexDate ?? getDailyHexagramMoment()) : undefined;
  const topicLabel =
    input.locale === "zh" ? topicLabels[input.topic].zh : topicLabels[input.topic].en;
  const today = getFortuneDateLabel(input.locale);
  const systems = getFortuneSystems(input.profile, input.locale);
  const useCompact = input.topic === "daily" || input.topic === "combined";
  const systemsBlock = formatFortuneSystemsBlock(input.profile, input.locale, {
    compact: useCompact,
  });
  const dailyVariety = input.topic === "daily" ? getDailyVarietyGuide(input.locale) : null;
  const weekdayProfile = input.topic === "daily" ? getWeekdayProfile(undefined, input.locale) : null;
  const dailyHexBlock =
    input.topic === "daily" && weekdayProfile && hexMoment
      ? formatDailyHexagramBlock(input.locale, hexMoment, null, weekdayProfile.isWeekend)
      : null;
  const recentBlock = formatRecentReadingsBlock(input.recentReadings ?? [], input.locale, input.topic);
  const feedbackBlock = input.feedbackLearnings?.trim() || null;
  const reviewQuestion =
    input.question?.trim() &&
    /准不准|对.{0,3}错|复盘|怎么修改|不一样|分析出|到底|忙|累/.test(input.question);

  const lines = [
    `主题：${topicLabel}`,
    `今日日期：${today}（香港时间，务必写入 title 与 reading 开头）`,
    input.profile.name ? `姓名：${input.profile.name}` : null,
    input.profile.birth_date ? `出生：${input.profile.birth_date}` : null,
    input.profile.birth_time ? `时辰：${input.profile.birth_time}` : null,
    input.zodiac ? `生肖：${input.zodiac}` : null,
    systems.westernSign ? `太阳星座：${systems.westernSign}` : null,
    systems.lifePath ? `生命灵数：${systems.lifePath}` : null,
    systems.baziHour ? `八字时辰：${systems.baziHour}` : systems.hourBranch ? `出生时辰：${systems.hourBranch}时` : null,
    `今日流时：${systems.currentHourBranch}时`,
    systems.chenggu ? `称骨：${systems.chenggu.totalLabel}（${systems.chenggu.poem.slice(0, 40)}…）` : null,
    "",
    systemsBlock,
    dailyHexBlock,
    dailyVariety,
    recentBlock,
    feedbackBlock,
    input.question?.trim()
      ? [
          "",
          reviewQuestion
            ? [
                "【用户核心问题 — 复盘/对错质问，必须像聊天一样先回答】",
                input.question.trim(),
                "要求：reading 开篇必须是 ## 直接回答（150–300字，宗师口吻，第一人称「我」）。",
                "结构：①先纠正他表述里片面的部分 ②今日 daily 分析逐条说准/偏（引用原话）③若错，明日怎么改 ④再写后面的多维章节。",
                "禁止：只生成模板化多维分析而不回应原话。",
              ].join("\n")
            : [
                "【用户核心问题 — 必须优先、直接回答】",
                input.question.trim(),
                "要求：标题与开篇点题；各段落都要回到这个问题；先给明确结论。",
              ].join("\n"),
          "",
        ].join("\n")
      : null,
    input.contextReading
      ? [
          "",
          "【用户刚看完以下分析，这是追问 — 请结合上文回答】",
          `标题：${input.contextReading.title}`,
          input.contextReading.summary ? `摘要：${input.contextReading.summary}` : null,
          `正文节选：${input.contextReading.reading.replace(/\s+/g, " ").slice(0, 1200)}…`,
          "",
        ]
          .filter(Boolean)
          .join("\n")
      : null,
    "",
    topicStructureGuide(input.topic, input.locale),
    "",
    "输出 JSON 格式：",
    "{",
    input.topic === "daily"
      ? '  "title": "日期（星期）· 决策简报 · 核心判断，例如：2026年6月22日（周一）· 决策简报 · 先整顿再扩张",'
      : input.question?.trim()
        ? '  "title": "点题标题（含问题关键词或卦名，15-30字）",'
        : '  "title": "有画面感的标题（含卦名或主题，15-30字）",',
    input.topic === "daily"
      ? '  "summary": "董事会一页纸式摘要（30-50字：P0 + 今日战略判断，勿写综合指数）",'
      : '  "summary": "一句话总览（30-50字，含综合指数或关键词）",',
    '  "reading": "完整 Markdown 正文（分段，见上方结构）",',
    '  "lucky": { "color": "幸运色", "number": "幸运数字", "direction": "方位", "keyword": "今日关键词" }',
    "}",
  ].filter(Boolean);

  return lines.join("\n");
}

function parseReadingJson(raw: string) {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? trimmed) as {
    title?: string;
    summary?: string;
    reading?: string;
    lucky?: Partial<FortuneLuckyElements>;
  };

  if (!parsed.reading?.trim()) {
    throw new Error("Empty reading from AI");
  }

  return {
    title: parsed.title?.trim() || "Your reading",
    summary: parsed.summary?.trim() || null,
    reading: parsed.reading.trim(),
    lucky: parsed.lucky
      ? {
          color: parsed.lucky.color ?? null,
          number: parsed.lucky.number ?? null,
          direction: parsed.lucky.direction ?? null,
          keyword: parsed.lucky.keyword ?? null,
        }
      : null,
  };
}

function fallbackReading(
  topic: FortuneTopic,
  locale: "en" | "zh",
  zodiac: string | null,
  profile: FortuneProfile,
  hexDate?: Date,
) {
  if (topic === "combined" && locale === "zh") {
    const systems = getFortuneSystems(profile, "zh");
    const dateLabel = getFortuneDateLabel("zh");
    return {
      title: `${dateLabel} · 多维综合 · 借力稳进`,
      summary: `【${dateLabel}】八字、生肖、星座、数字、塔罗、卦象一致指向：宜合作借力，综合 7.2/10。`,
      reading: [
        "## 多维概览",
        "各体系共同提示：今日/现阶段宜「收力、借力、抓关键人」，忌多头并进与情绪决策。",
        "",
        "## 八字要点",
        "甲戌年丙寅月辛未日癸巳时：创业型、会做局，但易心浮；六月宜布局非冲刺。",
        "",
        systems.chenggu
          ? `## 称骨算命\n骨重 **${systems.chenggu.totalLabel}** — ${systems.chenggu.poem}`
          : "## 称骨算命\n骨重适中，宜顺势守德。",
        "",
        "## 紫微斗数 ★★★★☆",
        systems.hourBranch
          ? `${systems.hourBranch}时生人，命宫偏创业掌权；2026 宜借团队与贵人。`
          : "命盘偏创业型，宜借团队与贵人。",
        "",
        "## 梅花易数卦象",
        "风雷益 — 损上益下，利合作。",
        "",
        "## 易经卦象",
        "益卦 — 利有攸往，利涉大川；宜合作借力。",
        "",
        `## 生肖运势 ★★★★☆`,
        zodiac ? `属${zodiac}，贵人运在合作与长辈，忌独断。` : "贵人运在合作，忌独断。",
        "",
        `## 星座运势 ★★★☆☆`,
        systems.westernSign
          ? `${systems.westernSign}：理想主义强，今日宜把愿景落成可执行小步。`
          : "宜把愿景落成可执行小步。",
        "",
        `## 数字能量 ★★★☆☆`,
        systems.lifePath
          ? `生命灵数 ${systems.lifePath}；1/3/6/9 旺，缺 5/7/8 — 补休息与守财。`
          : "1/3/6/9 旺，缺 5/7/8 — 补休息与守财。",
        "",
        "## 塔罗三省",
        "① 现状：力量（正）— 以柔制刚",
        "② 挑战：宝剑五（逆）— 避免争胜心态",
        "③ 指引：星币三（正）— 团队协作见成果",
        "",
        "## 各体系对照表",
        "✅ 一致：宜合作、抓关键人、分批清债",
        "⚠️ 注意：星座/数字提醒别因理想主义开太多战线",
        "",
        "## 统一结论",
        "先稳济南团队与 ICCI 一条线，AXPM 做减法；综合 **7.2/10**。",
        "",
        "## 综合行动清单",
        "✅ 约关键人、书面确认权责",
        "❌ 高杠杆、情绪赌博、同时开新战线",
        "",
        "## 一句总卦语",
        "「诸象同指一条路：借力、聚焦、慢即是快。」",
      ].join("\n"),
      lucky: {
        color: "黄色",
        number: "6",
        direction: "东南",
        keyword: "综合",
      } satisfies FortuneLuckyElements,
    };
  }

  if (locale === "zh" && topic === "daily") {
    const weekdayProfile = getWeekdayProfile(undefined, "zh");
    const hexMoment = hexDate ?? getDailyHexagramMoment();
    const hex = getMeihuaHexagram(hexMoment);
    const core = getHexagramCoreTagline(hex.name, "zh");
    const hexHint = getContextualHexagramHint(hex.name, {
      isWeekend: weekdayProfile.isWeekend,
      locale: "zh",
    });
    const dateLabel = getFortuneDateLabel("zh");
    const focusAction = weekdayProfile.primaryActions[0] ?? "抓一件最重要的事";
    const dayNum = Number.parseInt(getFortuneTodayKey().slice(8), 10) || 1;
    const careerStars = ["⭐⭐⭐☆", "⭐⭐⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐☆"][dayNum % 4];
    const wealthStars = ["⭐⭐⭐", "⭐⭐⭐☆", "⭐⭐", "⭐⭐⭐⭐"][dayNum % 4];
    const patronStars = weekdayProfile.isWeekend ? "⭐⭐⭐" : "⭐⭐⭐⭐";
    const { p0, p1, p2 } = rotateBusinessPriorities(dayNum);

    const priorityGoals: Record<string, { goal: string; action: string; done: string }> = {
      "济南团队": {
        goal: "对齐分工与本周节点，消除执行模糊地带",
        action: focusAction,
        done: "团队知晓今日优先级，无未闭环的待办",
      },
      "ICCI 合作": {
        goal: "推进资料包或待确认清单，降低合作摩擦",
        action: "整理一份对方可快速决策的材料",
        done: "清单发出或收到明确反馈节点",
      },
      "AXPM 平台": {
        goal: "修复一个影响体验或风控的关键问题",
        action: "处理最影响转化/合规的一项",
        done: "问题可验证关闭或进入监控",
      },
    };

    return {
      title: `${dateLabel} · 决策简报 · ${core}`,
      summary: `P0：${p0}。${hex.name} 框架下${core}，${weekdayProfile.scene.slice(0, 24)}…`,
      reading: [
        "## 报告日期",
        `${dateLabel} · 香港时间`,
        "",
        "## 执行摘要",
        `> **P0 ${p0}** — ${core}（${hex.name} 决策框架）`,
        "",
        "## 态势研判",
        `**决策框架：${hex.name}**（07:30 HKT 起念）`,
        "",
        hexHint,
        "",
        zodiac
          ? `属${zodiac}，三线并行：济南团队、ICCI 合作、AXPM 平台。${weekdayProfile.scene}`
          : weekdayProfile.scene,
        "",
        "## 业务优先级",
        "",
        buildPrioritySection("P0", p0, priorityGoals[p0].goal, priorityGoals[p0].action, priorityGoals[p0].done),
        "",
        buildPrioritySection("P1", p1, priorityGoals[p1].goal, priorityGoals[p1].action, priorityGoals[p1].done),
        "",
        buildPrioritySection("P2", p2, priorityGoals[p2].goal, "一句对齐或暂缓", "不占用 P0 时段"),
        "",
        "## 分项评估",
        "",
        "### 事业推进 " + careerStars,
        "",
        weekdayProfile.isWeekend
          ? "> 周末重内务与节奏，不宜硬推外部谈判。"
          : "> 计划可行，瓶颈在沟通与内部协调，非市场缺机会。",
        "",
        "### 资金与现金流 " + wealthStars,
        "",
        weekdayProfile.wealthAngle,
        "",
        "### 人脉与资源 " + patronStars,
        "",
        weekdayProfile.isWeekend
          ? "资源在内务与资料准备，为下周对外沟通蓄力。"
          : "优先对接有资源、能缩短路径的长辈或合作方。",
        "",
        "## 风险与约束",
        "",
        "> 多线并行 + 缺数 5/7/8 → 易急、易散、易情绪决策。",
        "",
        "❌ 情绪交易、高杠杆、无准备见大客户",
        "❌ 临时改全盘计划或同时开新战线",
        "",
        "## 今日行动清单",
        "",
        `✅ ${focusAction}`,
        "✅ 明确 P0 完成标准并复盘 10 分钟",
        "✅ 记录一项风险与对应预案",
        "",
        weekdayProfile.isWeekend ? "❌ 不宜硬推外部大单" : "❌ 不宜分散到第四条战线",
        "❌ 不宜深夜做资金或合作拍板",
        "",
        "## 决策锚点",
        "",
        weekdayProfile.isWeekend
          ? "> **先整理，再出手；P0 过关，其余让路。**"
          : "> **先治内，再拓外；P0 过关，其余让路。**",
        "",
        "## 阶段路线图",
        "",
        "- **本周**：P0 闭环，内部节奏对齐",
        "- **下周**：合作与回款信号开始清晰",
        "- **月底前**：至少一条业务线看到可验收成果",
      ].join("\n"),
      lucky: {
        color: weekdayProfile.isWeekend ? "米色" : "藏青",
        number: String((dayNum % 9) + 1),
        direction: weekdayProfile.isWeekend ? "西南" : "东南",
        keyword: core,
      } satisfies FortuneLuckyElements,
    };
  }

  if (locale === "zh") {
    const dateLabel = getFortuneDateLabel("zh");
    const systems = getFortuneSystems(profile, "zh");
    return {
      title: `${dateLabel} · 风雷益卦 · 借力而上`,
      summary: `【${dateLabel}】今日宜收力借势，抓济南团队与 ICCI 关键节点，综合 7/10。`,
      reading: [
        "## 今日日期",
        dateLabel,
        "",
        "## 今日卦象",
        "益卦 — 「收人力，借势而上；勿贪快，稳步为先。」",
        "",
        "## 核心提醒",
        zodiac
          ? `属${zodiac}的你，1/3/6/9 能量仍旺，但缺 5 代表今日不宜硬扛。你在济南团队、ICCI 合作、AXPM 平台三线并进，最耗的是精神而非能力。`
          : "今日不宜硬扛，先抓最关键的一两件事。",
        "",
        "## 事业运 ★★★★☆",
        "适合谈合作、确认济南团队关键成员任务。❌ 不宜强逼成交或独自冲业绩。",
        "",
        "## 财运 ★★★☆☆",
        "有机会谈资金与合作，但属长期价值，非今日落袋。❌ 忌冲动投资、情绪交易。",
        "",
        "## 贵人运 ★★★★☆",
        "年纪较长、有资源的人今日价值高。主动约茶、吃饭、简短对齐即可。",
        "",
        "## 感情 / 心态 ★★★☆☆",
        "易因进展慢而焦虑。提醒自己：六月是布局月，不是收获月。",
        "",
        "## 今日策略",
        "✅ 铺路、建立关系、交换资源",
        "✅ 处理平台最影响客户体验的问题，其余授权团队",
        "❌ 强逼表态、开新战线、熬夜追数据",
        "",
        "## 结合你的三件事",
        "① **济南团队** ★★★★☆ — 确认核心 3-5 人任务，放手次要人事",
        "② **ICCI 合作** ★★★★☆ — 展示价值与资料，谈资源不谈急利",
        "③ **AXPM 平台** ★★★☆☆ — 只处理关键故障，小问题今日可缓",
        "",
        "## 今日一句卦语",
        "「先结缘，再成交；先布局，再收获。」",
        "",
        "## 综合指数",
        "中上吉 **7/10**",
        profile.notes ? `\n> 档案参考：${profile.notes.split("\n")[0]}` : "",
      ].join("\n"),
      lucky: {
        color: "黄色",
        number: "6",
        direction: "东南",
        keyword: "借力",
      } satisfies FortuneLuckyElements,
    };
  }
  return {
    title: `${getFortuneDateLabel("en")} · Quiet clarity`,
    summary: `Steady progress beats rushed starts today. Score: 7/10.`,
    reading: [
      "## Today's date",
      getFortuneDateLabel("en"),
      "",
      "## Focus",
      zodiac
        ? `As a ${zodiac} year soul, your energy favors reflection before action.`
        : "Your energy favors reflection before action.",
      "",
      "## Career ★★★★☆",
      "Confirm key tasks with your Jinan team. Avoid forcing closes.",
      "",
      "## Wealth ★★★☆☆",
      "Opportunities appear but cash may lag. No impulsive trades.",
      "",
      "## Strategy",
      "✅ Build relationships, delegate platform minor issues",
      "❌ New fronts, emotional decisions, late-night grinding",
    ].join("\n\n"),
    lucky: {
      color: "Blue",
      number: "6",
      direction: "East",
      keyword: "Patience",
    } satisfies FortuneLuckyElements,
  };
}

function maxTokensForTopic(topic: FortuneTopic) {
  if (topic === "combined") return 3000;
  if (topic === "daily") return 2200;
  if (topic === "ziwei" || topic === "general" || topic === "custom") return 2000;
  if (topic === "mianxiang") return 2200;
  return 1600;
}

function finalizeReading(
  topic: FortuneTopic,
  locale: "en" | "zh",
  output: {
    title: string;
    summary: string | null;
    reading: string;
    lucky: FortuneLuckyElements | null;
  },
  hasQuestion = false,
) {
  if (topic === "daily") {
    const sanitized = {
      ...output,
      title: output.title,
      summary: sanitizeDailySummary(output.summary),
      reading: sanitizeDailyReadingMarkdown(output.reading),
    };
    return ensureDailyReadingDate(sanitized, locale);
  }
  if (!hasQuestion && (topic === "combined" || topic === "career" || topic === "wealth" || topic === "love")) {
    return { ...output, fortune_date: getFortuneTodayKey() };
  }
  return { ...output, fortune_date: null as string | null };
}

export async function generateFortuneReading(input: {
  topic: FortuneTopic;
  question?: string | null;
  profile: FortuneProfile;
  locale: "en" | "zh";
  contextReading?: FortuneReading | null;
  recentReadings?: Array<{
    topic: string;
    title: string;
    summary: string | null;
    fortune_date?: string | null;
    question?: string | null;
    reading?: string;
    lucky?: { color: string | null; number: string | null; keyword: string | null } | null;
  }>;
  feedbackLearnings?: string | null;
  mode?: "platform" | "customer";
  aiConfig?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  hexDate?: Date;
}) {
  const zodiac = input.profile.birth_date
    ? getChineseZodiac(input.profile.birth_date, input.locale)
    : null;

  const hexDate = input.topic === "daily" ? (input.hexDate ?? getDailyHexagramMoment()) : undefined;

  const hasQuestion = Boolean(input.question?.trim());
  const customerMode = input.mode === "customer";
  const apiKey = input.aiConfig?.apiKey?.trim();
  const aiReady = customerMode ? Boolean(apiKey) : isDeepSeekConfigured();

  if (!aiReady) {
    const fb = fallbackReading(input.topic, input.locale, zodiac, input.profile, hexDate);
    const finalized = finalizeReading(
      input.topic,
      input.locale,
      {
        title: fb.title,
        summary: fb.summary,
        reading: fb.reading,
        lucky: fb.lucky,
      },
      hasQuestion,
    );
    return { ...finalized, zodiac, usedAi: false };
  }

  const systemPrompt = customerMode
    ? buildCustomerSystemPrompt(input.locale, input.topic, input.profile)
    : buildSystemPrompt(input.locale, input.topic);
  const userPrompt = customerMode
    ? buildCustomerUserPrompt({ ...input, zodiac })
    : buildUserPrompt({ ...input, zodiac, hexDate });

  const result = await deepSeekChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    json: true,
    temperature: input.topic === "daily" ? 0.86 : 0.72,
    maxTokens: maxTokensForTopic(input.topic),
    apiKey: input.aiConfig?.apiKey,
    baseUrl: input.aiConfig?.baseUrl,
    model: input.aiConfig?.model,
  });

  if (!result.ok) {
    const fb = fallbackReading(input.topic, input.locale, zodiac, input.profile, hexDate);
    const finalized = finalizeReading(
      input.topic,
      input.locale,
      {
        title: fb.title,
        summary: fb.summary,
        reading: fb.reading,
        lucky: fb.lucky,
      },
      hasQuestion,
    );
    return { ...finalized, zodiac, usedAi: false, aiError: result.error };
  }

  try {
    const parsed = parseReadingJson(result.content);
    const legacyDaily =
      input.topic === "daily" && isLegacyDailyReading(parsed.reading);
    const body = legacyDaily
      ? fallbackReading(input.topic, input.locale, zodiac, input.profile, hexDate)
      : {
          title: parsed.title,
          summary: parsed.summary,
          reading: parsed.reading,
          lucky: parsed.lucky,
        };
    const finalized = finalizeReading(
      input.topic,
      input.locale,
      {
        title: body.title,
        summary: body.summary,
        reading: body.reading,
        lucky: body.lucky,
      },
      hasQuestion,
    );
    return {
      ...finalized,
      zodiac,
      usedAi: !legacyDaily,
      ...(legacyDaily ? { aiError: "legacy_format_rejected" as const } : {}),
    };
  } catch {
    const fb = fallbackReading(input.topic, input.locale, zodiac, input.profile, hexDate);
    const finalized = finalizeReading(
      input.topic,
      input.locale,
      {
        title: fb.title,
        summary: fb.summary,
        reading: fb.reading,
        lucky: fb.lucky,
      },
      hasQuestion,
    );
    return { ...finalized, zodiac, usedAi: false };
  }
}
