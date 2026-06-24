import type { FortuneProfile } from "@/types/fortune";
import { getLunarMonthDay } from "@/lib/fortune/lunar";
import { getChineseHourBranch, parseBaziFromNotes } from "@/lib/fortune/hour";

/** 紫微斗数以寅宫为起点，下标 0 = 寅 … 11 = 丑 */
const YIN_BRANCHES = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"] as const;
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

/** 子丑寅卯…亥（传统地支序，用于命宫/身宫起算） */
const STANDARD_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

const BRANCH_TO_STANDARD: Record<string, number> = Object.fromEntries(
  STANDARD_BRANCHES.map((b, i) => [b, i]),
);

const TIGER_RULE: Record<string, number> = {
  甲: 2,
  己: 2,
  乙: 4,
  庚: 4,
  丙: 6,
  辛: 6,
  丁: 8,
  壬: 8,
  戊: 0,
  癸: 0,
};

const FIVE_ELEMENTS_TABLE = ["木三局", "金四局", "水二局", "火六局", "土五局"] as const;
const FIVE_ELEMENTS_VALUE: Record<string, number> = {
  水二局: 2,
  木三局: 3,
  金四局: 4,
  土五局: 5,
  火六局: 6,
};

const MING_TRAITS: Record<string, string> = {
  紫微: "统御型，重格局与掌控",
  天机: "智谋型，善策划变通",
  太阳: "外放型，重名誉与影响力",
  武曲: "执行型，重财务与决断",
  天同: "享福型，宜合作与借力",
  廉贞: "外交型，魅力强但情绪起伏",
  天府: "库藏型，守成与管理见长",
  太阴: "内秀型，重直觉与内在资源",
  贪狼: "欲望型，多才但易分散",
  巨门: "口才型，宜专业深度",
  天相: "辅佐型，贵人缘与协调力",
  天梁: "荫庇型，逢凶化吉",
  七杀: "开创型，大起大落、敢冲",
  破军: "变革型，破旧立新",
};

function fixIndex(index: number, cycle = 12) {
  return ((index % cycle) + cycle) % cycle;
}

function yinBranch(index: number) {
  return YIN_BRANCHES[fixIndex(index)];
}

function getYearStemIndex(profile: FortuneProfile) {
  const bazi = parseBaziFromNotes(profile.notes);
  if (bazi?.year) {
    const idx = STEMS.indexOf(bazi.year[0] as (typeof STEMS)[number]);
    if (idx >= 0) return idx;
  }
  if (!profile.birth_date) return -1;
  return fixIndex(new Date(`${profile.birth_date}T12:00:00`).getFullYear() - 4, 10);
}

/** 命宫、身宫（寅起首；时辰用子=0的地支序） */
function getSoulBodyIndex(lunarMonth: number, hourBranch: string) {
  const monthIndex = lunarMonth - 1;
  const timeIndex = BRANCH_TO_STANDARD[hourBranch] ?? 0;
  return {
    soulIndex: fixIndex(monthIndex - timeIndex),
    bodyIndex: fixIndex(monthIndex + timeIndex),
  };
}

function getSoulStemBranch(soulIndex: number, yearStemIndex: number) {
  const startStem = TIGER_RULE[STEMS[yearStemIndex]] ?? 2;
  const stem = STEMS[fixIndex(startStem + soulIndex, 10)];
  const branch = yinBranch(soulIndex);
  return { stem, branch, gz: `${stem}${branch}` };
}

/** 纳音地支取数：子午丑未1、寅申卯酉2、辰巳戌亥3 */
function earthlyBranchNumber(branch: string) {
  const idx = STANDARD_BRANCHES.indexOf(branch as (typeof STANDARD_BRANCHES)[number]);
  if (idx < 0) return 1;
  return Math.floor(fixIndex(idx, 6) / 2) + 1;
}

/** 纳音五行局（命宫干支） */
function getFiveElementsJu(stem: string, branch: string) {
  const stemNum = Math.floor(STEMS.indexOf(stem as (typeof STEMS)[number]) / 2) + 1;
  const branchNum = earthlyBranchNumber(branch);
  let sum = stemNum + branchNum;
  while (sum > 5) sum -= 5;
  return FIVE_ELEMENTS_TABLE[sum - 1];
}

/** 起紫微星诀（六五四三二…） */
function getStartIndex(lunarDay: number, juNum: number) {
  let offset = -1;
  let quotient = 0;
  let remainder = -1;

  do {
    offset += 1;
    const divisor = lunarDay + offset;
    quotient = Math.floor(divisor / juNum);
    remainder = divisor % juNum;
  } while (remainder !== 0);

  quotient %= 12;
  let ziweiIndex = quotient - 1;
  if (offset % 2 === 0) {
    ziweiIndex += offset;
  } else {
    ziweiIndex -= offset;
  }

  ziweiIndex = fixIndex(ziweiIndex);
  const tianfuIndex = fixIndex(12 - ziweiIndex);
  return { ziweiIndex, tianfuIndex };
}

function placeMajorStars(ziweiIndex: number, tianfuIndex: number) {
  const stars: string[][] = Array.from({ length: 12 }, () => []);
  const add = (idx: number, star: string) => {
    stars[fixIndex(idx)].push(star);
  };

  const ziweiGroup: Array<string | ""> = [
    "紫微",
    "天机",
    "",
    "太阳",
    "武曲",
    "天同",
    "",
    "",
    "廉贞",
  ];
  ziweiGroup.forEach((star, i) => {
    if (star) add(ziweiIndex - i, star);
  });

  const tianfuGroup: Array<string | ""> = [
    "天府",
    "太阴",
    "贪狼",
    "巨门",
    "天相",
    "天梁",
    "七杀",
    "",
    "",
    "",
    "破军",
  ];
  tianfuGroup.forEach((star, i) => {
    if (star) add(tianfuIndex + i, star);
  });

  return stars;
}

export interface ZiweiPalace {
  branch: string;
  stars: string[];
}

export interface ZiweiChart {
  wuxingJu: string;
  mingGong: string;
  shenGong: string;
  mingStars: string[];
  shenStars: string[];
  trait: string;
  lunarLabel: string;
  summary: string;
  palaces: ZiweiPalace[];
}

export function getZiweiChart(profile: FortuneProfile, locale: "en" | "zh" = "zh"): ZiweiChart | null {
  if (!profile.birth_date || !profile.birth_time) return null;

  const hourBranch = getChineseHourBranch(profile.birth_time);
  if (!hourBranch) return null;

  const lunar = getLunarMonthDay(profile.birth_date);
  if (!lunar) return null;

  const yearStemIndex = getYearStemIndex(profile);
  if (yearStemIndex < 0) return null;

  const { soulIndex, bodyIndex } = getSoulBodyIndex(lunar.month, hourBranch);
  const soul = getSoulStemBranch(soulIndex, yearStemIndex);
  const wuxingJu = getFiveElementsJu(soul.stem, soul.branch);
  const juNum = FIVE_ELEMENTS_VALUE[wuxingJu] ?? 4;
  const { ziweiIndex, tianfuIndex } = getStartIndex(lunar.day, juNum);
  const starMap = placeMajorStars(ziweiIndex, tianfuIndex);

  const mingStars = starMap[soulIndex];
  const shenStars = starMap[bodyIndex];
  const shenBranch = yinBranch(bodyIndex);

  const traitStar = mingStars[0] ?? "紫微";
  const trait =
    locale === "zh"
      ? (MING_TRAITS[traitStar] ?? "多元命格，宜综合判断")
      : `Led by ${traitStar}`;

  const lunarLabel =
    locale === "zh"
      ? `农历${lunar.month}月${lunar.day}日${hourBranch}时${lunar.approximate ? "（近似）" : ""}`
      : `Lunar ${lunar.month}/${lunar.day}, ${hourBranch} hour`;

  const summary =
    locale === "zh"
      ? `${wuxingJu} · 命宫${soul.gz}（${mingStars.join("、") || "空宫借对宫"}）· 身宫${shenBranch}`
      : `${wuxingJu} · Life ${soul.gz} · Body ${shenBranch}`;

  const palaces = YIN_BRANCHES.map((branch, index) => ({
    branch,
    stars: starMap[index],
  }));

  return {
    wuxingJu,
    mingGong: soul.gz,
    shenGong: shenBranch,
    mingStars,
    shenStars,
    trait,
    lunarLabel,
    summary,
    palaces,
  };
}

export function formatZiweiBlock(profile: FortuneProfile, locale: "en" | "zh", compact = false) {
  const chart = getZiweiChart(profile, locale);
  if (!chart) return null;

  if (compact) {
    if (locale === "zh") {
      return [
        "【紫微要点（勿重复展开整盘）】",
        `- ${chart.summary}`,
        `- 身宫${chart.shenGong}：${chart.shenStars.join("、") || "—"}`,
        `- ${chart.trait}`,
      ].join("\n");
    }
    return `[Zi Wei snapshot] ${chart.summary}; body ${chart.shenGong}`;
  }

  const palaceLines = chart.palaces
    .filter((p) => p.stars.length > 0)
    .map((p) => `  · ${p.branch}：${p.stars.join("、")}`)
    .join("\n");

  if (locale === "zh") {
    return [
      "【紫微斗数排盘】",
      `- ${chart.lunarLabel}`,
      `- 五行局：${chart.wuxingJu}`,
      `- 命宫：${chart.mingGong} · 主星：${chart.mingStars.join("、") || "（空宫借对宫）"}`,
      `- 身宫：${chart.shenGong} · 主星：${chart.shenStars.join("、") || "—"}`,
      `- 十四主星分布：`,
      palaceLines,
      `- 命格特质：${chart.trait}`,
    ].join("\n");
  }

  return [
    "[Zi Wei chart]",
    `- ${chart.lunarLabel}`,
    `- Bureau: ${chart.wuxingJu}`,
    `- Life palace: ${chart.mingGong} · Stars: ${chart.mingStars.join(", ") || "—"}`,
    `- Body palace: ${chart.shenGong} · Stars: ${chart.shenStars.join(", ") || "—"}`,
    `- Major stars:`,
    palaceLines,
    `- Trait: ${chart.trait}`,
  ].join("\n");
}
