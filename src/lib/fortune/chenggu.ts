import type { FortuneProfile } from "@/types/fortune";
import { getChineseHourBranch, parseBaziFromNotes, type BaziPillars } from "@/lib/fortune/hour";

export { getChineseHourBranch, parseBaziFromNotes } from "@/lib/fortune/hour";
export type { BaziPillars } from "@/lib/fortune/hour";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

/** Bone weight in 钱 (10钱 = 1两) */
const YEAR_WEIGHT: Record<string, number> = {
  甲子: 12,
  乙丑: 9,
  丙寅: 6,
  丁卯: 7,
  戊辰: 12,
  己巳: 5,
  庚午: 9,
  辛未: 12,
  壬申: 7,
  癸酉: 8,
  甲戌: 15,
  乙亥: 9,
  丙子: 16,
  丁丑: 8,
  戊寅: 8,
  己卯: 19,
  庚辰: 12,
  辛巳: 7,
  壬午: 5,
  癸未: 7,
  甲申: 5,
  乙酉: 15,
  丙戌: 6,
  丁亥: 16,
  戊子: 15,
  己丑: 7,
  庚寅: 9,
  辛卯: 12,
  壬辰: 10,
  癸巳: 7,
  甲午: 15,
  乙未: 6,
  丙申: 5,
  丁酉: 14,
  戊戌: 14,
  己亥: 9,
  庚子: 7,
  辛丑: 7,
  壬寅: 9,
  癸卯: 12,
  甲辰: 8,
  乙巳: 7,
  丙午: 13,
  丁未: 5,
  戊申: 14,
  己酉: 5,
  庚戌: 9,
  辛亥: 17,
  壬子: 5,
  癸丑: 7,
  甲寅: 12,
  乙卯: 8,
  丙辰: 8,
  丁巳: 6,
  戊午: 19,
  己未: 6,
  庚申: 8,
  辛酉: 16,
  壬戌: 10,
  癸亥: 7,
};

const MONTH_WEIGHT_BY_BRANCH: Record<string, number> = {
  寅: 6,
  卯: 7,
  辰: 18,
  巳: 8,
  午: 5,
  未: 16,
  申: 10,
  酉: 8,
  戌: 9,
  亥: 5,
  子: 15,
  丑: 8,
};

const DAY_WEIGHT = [
  0, 5, 10, 8, 15, 16, 15, 8, 16, 8, 9, 9, 8, 7, 17, 8, 9, 8, 8, 19, 6, 6, 7, 7, 9, 16, 7, 8, 8, 13, 6,
] as const;

const HOUR_WEIGHT: Record<string, number> = {
  子: 16,
  丑: 6,
  寅: 7,
  卯: 10,
  辰: 9,
  巳: 16,
  午: 10,
  未: 8,
  申: 8,
  酉: 9,
  戌: 6,
  亥: 6,
};

const CHENGGU_POEMS: Array<{ min: number; max: number; zh: string; en: string }> = [
  { min: 21, max: 23, zh: "短命非业，空劳苦。命中带难，多灾多难。", en: "A restless path with early trials; perseverance is the lesson." },
  { min: 24, max: 29, zh: "为人多学少成，六亲无靠，宜外出发展。", en: "Self-reliant spirit; success often comes away from home." },
  { min: 30, max: 34, zh: "衣食无亏，一生安泰，贵人相助，逢凶化吉。", en: "Stable livelihood with helpful allies when needed." },
  { min: 35, max: 39, zh: "目清口快，高强好达，中限有波折，老来安康。", en: "Sharp and capable; mid-life tests, later peace." },
  { min: 40, max: 44, zh: "聪明富贵，文武双全，中年顺遂，晚景荣华。", en: "Talented and prosperous; strong middle years." },
  { min: 45, max: 49, zh: "心慈性急，福禄双全，中年后大展宏图。", en: "Kind yet driven; major growth after mid-life." },
  { min: 50, max: 54, zh: "名利双收，家业兴旺，子孙贤能，福寿绵长。", en: "Fame and fortune align; legacy builds steadily." },
  { min: 55, max: 59, zh: "格局宏大，权柄在握，一生贵气，但忌独断。", en: "Grand destiny with leadership — guard against arrogance." },
  { min: 60, max: 72, zh: "骨重非凡，天命所归，大起大落，需修心守德。", en: "Rare weight — dramatic rises demand humility." },
];

export interface ChengguResult {
  pillars: BaziPillars | null;
  yearWeight: number;
  monthWeight: number;
  dayWeight: number;
  hourWeight: number;
  totalQian: number;
  totalLabel: string;
  poem: string;
  source: "notes" | "computed";
}

function ganZhiYear(year: number) {
  const stem = STEMS[(year - 4) % 10];
  const branch = BRANCHES[(year - 4) % 12];
  return `${stem}${branch}`;
}

function formatWeight(qian: number) {
  const liang = Math.floor(qian / 10);
  const rest = qian % 10;
  if (liang <= 0) return `${rest}钱`;
  if (rest === 0) return `${liang}两`;
  return `${liang}两${rest}钱`;
}

function poemForWeight(totalQian: number, locale: "en" | "zh") {
  const poem = CHENGGU_POEMS.find((item) => totalQian >= item.min && totalQian <= item.max);
  if (!poem) {
    return locale === "zh"
      ? "骨重适中，宜顺势而为，修心以载福。"
      : "Balanced weight — steady effort and inner calm bring fortune.";
  }
  return locale === "zh" ? poem.zh : poem.en;
}

function monthBranchFromSolar(month: number) {
  const branches = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
  return branches[month - 1] ?? "寅";
}

export function getChengguReading(profile: FortuneProfile, locale: "en" | "zh" = "zh"): ChengguResult | null {
  if (!profile.birth_date) return null;

  const parsed = new Date(`${profile.birth_date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const fromNotes = parseBaziFromNotes(profile.notes);
  const hourBranch = getChineseHourBranch(profile.birth_time);

  const yearGz = fromNotes?.year ?? ganZhiYear(parsed.getFullYear());
  const monthGz = fromNotes?.month ?? `${STEMS[(parsed.getMonth() + 2) % 10]}${monthBranchFromSolar(parsed.getMonth() + 1)}`;
  const dayGz =
    fromNotes?.day ??
    `${STEMS[(parsed.getDate() + 9) % 10]}${BRANCHES[(parsed.getDate() + 1) % 12]}`;
  const hourGz = fromNotes?.hour ?? (hourBranch ? `${STEMS[(BRANCHES.indexOf(hourBranch as (typeof BRANCHES)[number]) + 2) % 10]}${hourBranch}` : "癸巳");

  const yearWeight = YEAR_WEIGHT[yearGz] ?? 12;
  const monthBranch = monthGz[1] ?? "寅";
  const monthWeight = MONTH_WEIGHT_BY_BRANCH[monthBranch] ?? 8;
  const dayWeight = DAY_WEIGHT[Math.min(parsed.getDate(), DAY_WEIGHT.length - 1)] ?? 8;
  const hourWeight = hourBranch ? (HOUR_WEIGHT[hourBranch] ?? 8) : 8;

  const totalQian = yearWeight + monthWeight + dayWeight + hourWeight;

  return {
    pillars: { year: yearGz, month: monthGz, day: dayGz, hour: hourGz },
    yearWeight,
    monthWeight,
    dayWeight,
    hourWeight,
    totalQian,
    totalLabel: formatWeight(totalQian),
    poem: poemForWeight(totalQian, locale),
    source: fromNotes ? "notes" : "computed",
  };
}

export function formatChengguBlock(profile: FortuneProfile, locale: "en" | "zh") {
  const result = getChengguReading(profile, locale);
  if (!result) return null;

  if (locale === "zh") {
    return [
      "【袁天罡称骨】",
      `- 四柱：${result.pillars?.year}年 · ${result.pillars?.month}月 · ${result.pillars?.day}日 · ${result.pillars?.hour}时`,
      `- 骨重：年${formatWeight(result.yearWeight)} + 月${formatWeight(result.monthWeight)} + 日${formatWeight(result.dayWeight)} + 时${formatWeight(result.hourWeight)} = **${result.totalLabel}**`,
      `- 歌诀：${result.poem}`,
    ].join("\n");
  }

  return [
    "[Bone weight fortune]",
    `- Pillars: ${result.pillars?.year} / ${result.pillars?.month} / ${result.pillars?.day} / ${result.pillars?.hour}`,
    `- Weight total: ${result.totalLabel}`,
    `- Verse: ${result.poem}`,
  ].join("\n");
}
