import { FORTUNE_TIMEZONE } from "@/lib/fortune/date";
import { getCurrentHourBranch, type HourBranch } from "@/lib/fortune/hour";

/** 先天八卦序：0坤 1艮 2坎 3巽 4震 5离 6兑 7乾 */
const TRIGRAMS = ["坤", "艮", "坎", "巽", "震", "离", "兑", "乾"] as const;

/** 8×8 六十四卦名（上卦为行，下卦为列） */
const HEXAGRAM_64: string[][] = [
  ["坤为地", "地雷复", "水地比", "风地观", "雷地豫", "火地晋", "泽地萃", "天地否"],
  ["地山谦", "艮为山", "水山蹇", "风山渐", "雷山小过", "火山旅", "泽山咸", "天山遁"],
  ["地水师", "山水蒙", "坎为水", "风水涣", "雷水解", "火水未济", "泽水困", "天水讼"],
  ["地风升", "山风蛊", "水风井", "巽为风", "雷风恒", "火风鼎", "泽风大过", "天风姤"],
  ["地雷复", "山雷颐", "水雷屯", "风雷益", "震为雷", "火雷噬嗑", "泽雷随", "天雷无妄"],
  ["地火明夷", "山火贲", "水火既济", "风火家人", "雷火丰", "离为火", "泽火革", "天火同人"],
  ["地泽临", "山泽损", "水泽节", "风泽中孚", "雷泽归妹", "火泽睽", "兑为泽", "天泽履"],
  ["地天泰", "山天大畜", "水天需", "风天小畜", "雷天大壮", "火天大有", "泽天夬", "乾为天"],
];

const HEXAGRAM_HINT: Record<string, { zh: string; en: string }> = {
  坤为地: { zh: "厚德载物，宜守成包容", en: "Steady earth — patience and support" },
  乾为天: { zh: "刚健进取，宜主动开创", en: "Heaven — initiative and leadership" },
  山风蛊: { zh: "积弊待治，宜先整顿再发展", en: "Decay — put things in order before expanding" },
  火水未济: { zh: "事未终了，宜慎始敬终", en: "Before Completion — finish what you started" },
  风雷益: { zh: "损上益下，宜利人利己", en: "Increase — mutual benefit" },
  火风鼎: { zh: "鼎新革故，宜转型升级", en: "Cauldron — renewal and refinement" },
  水风井: { zh: "井养不穷，宜深耕专业", en: "Well — steady nourishment through craft" },
  天风姤: { zh: "不期而遇，宜慎选合作", en: "Coming to meet — watch sudden encounters" },
  山地剥: { zh: "剥落消损，宜止损守势", en: "Stripping — conserve, avoid overreach" },
  地雷复: { zh: "一阳来复，宜重启旧事", en: "Return — good time to restart" },
  坎为水: { zh: "险中求进，宜冷静谋划", en: "Water — navigate risk with calm" },
  离为火: { zh: "光明附丽，宜展示表达", en: "Fire — clarity and visibility" },
  地风升: { zh: "柔顺而升，宜循序渐进", en: "Pushing Upward — steady ascent" },
  泽山咸: { zh: "感应相通，宜以诚动人", en: "Influence — genuine connection" },
};

/** One-line core for title subtitle, ChatGPT-style */
const HEXAGRAM_CORE: Record<string, string> = {
  山风蛊: "先整顿，再发展",
  火水未济: "慎始敬终",
  风雷益: "利人利己",
  火风鼎: "鼎新升级",
  地雷复: "重启旧事",
  坎为水: "险中求进",
  离为火: "展示表达",
  坤为地: "守成包容",
  乾为天: "主动开创",
  地风升: "循序渐进",
  天风姤: "慎选合作",
  雷泽归妹: "顺势而为",
  风泽中孚: "以诚待人",
  风山渐: "循序渐进",
};

const HOUR_BRANCH_INDEX: Record<HourBranch, number> = {
  子: 0,
  丑: 1,
  寅: 2,
  卯: 3,
  辰: 4,
  巳: 5,
  午: 6,
  未: 7,
  申: 8,
  酉: 9,
  戌: 10,
  亥: 11,
};

function hkDateParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: FORTUNE_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

export type YijingHexagram = {
  name: string;
  upperTrigram: string;
  lowerTrigram: string;
  movingLine: number;
  hint: string;
  method: string;
};

/** 梅花易数：年月日时起卦（娱乐参考）；hourBranch 为空则用 date 时刻的流时 */
export function getMeihuaHexagram(date = new Date(), hourBranch?: HourBranch | null): YijingHexagram {
  const { year, month, day, hour } = hkDateParts(date);
  const branch = hourBranch ?? getCurrentHourBranch(date, FORTUNE_TIMEZONE);
  const hourNum = HOUR_BRANCH_INDEX[branch] + 1;

  const upperIdx = (year + month + day) % 8;
  const lowerIdx = (year + month + day + hourNum) % 8;
  const movingLine = ((year + month + day + hourNum) % 6) + 1;

  const upperTrigram = TRIGRAMS[upperIdx];
  const lowerTrigram = TRIGRAMS[lowerIdx];
  const name = HEXAGRAM_64[upperIdx][lowerIdx];
  const hintEntry = HEXAGRAM_HINT[name];

  const timeLabel = new Intl.DateTimeFormat("zh-CN", {
    timeZone: FORTUNE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return {
    name,
    upperTrigram,
    lowerTrigram,
    movingLine,
    hint: hintEntry?.zh ?? "观卦象动静，顺势而为",
    method: `起念问卦：${year}年${month}月${day}日 ${timeLabel} 香港时间（${branch}时），${year}+${month}+${day}得上卦${upperTrigram}，加时${hourNum}得下卦${lowerTrigram}，动爻第${movingLine}爻`,
  };
}

/** Contextual hint: same hexagram reads differently on weekend vs weekday. */
export function getContextualHexagramHint(
  hexName: string,
  opts: { isWeekend: boolean; locale: "en" | "zh" },
): string {
  const base = HEXAGRAM_HINT[hexName]?.[opts.locale === "zh" ? "zh" : "en"] ?? hexName;

  if (!opts.isWeekend || opts.locale !== "zh") return base;

  const weekend: Record<string, string> = {
    风雷益: "益在周末宜整理增益、梳理名单与资料，非外出谈合作",
    地雷复: "复在周末宜重启搁置文档、整理旧案，非奔波日",
    水风井: "井在周末宜深耕内务、修平台一项，非社交日",
    坤为地: "坤在周末宜守成收纳、家庭回血",
    天风姤: "姤在周末宜慎接新信息，先整理再回应",
  };
  return weekend[hexName] ?? `${base}；周末宜内化执行，不宜硬套外出/谈合作话术`;
}

export function getHexagramCoreTagline(hexName: string, locale: "en" | "zh" = "zh") {
  if (locale === "zh") {
    return HEXAGRAM_CORE[hexName] ?? HEXAGRAM_HINT[hexName]?.zh.split("，")[0] ?? "顺势而为";
  }
  return HEXAGRAM_HINT[hexName]?.en.split("—")[0]?.trim() ?? "Go with the flow";
}

export function formatDailyHexagramBlock(
  locale: "en" | "zh",
  date = new Date(),
  hourBranch?: HourBranch | null,
  isWeekend = false,
) {
  const hex = getMeihuaHexagram(date, hourBranch);
  const hint = getContextualHexagramHint(hex.name, { isWeekend, locale });
  const core = getHexagramCoreTagline(hex.name, locale);
  if (locale === "zh") {
    return [
      "【起卦 — 按今日晨间起念问卦时刻（07:30 香港时间），须贯穿全文】",
      `- 本卦：${hex.name}（上${hex.upperTrigram}下${hex.lowerTrigram}）`,
      `- 核心一句（须用 blockquote 写出）：「${core}」`,
      `- 展开参考：${hint}`,
      `- 起卦说明：${hex.method}`,
      `- title 格式：日期（星期）· ${hex.name} · ${core}`,
      "- 风格：简洁口语、有温度；不要长段「时辰能量」模板",
    ].join("\n");
  }
  return [
    `[Hexagram — daily question moment 07:30 HKT] ${hex.name}`,
    `Core: ${core}`,
    `Theme: ${hint}`,
  ].join("\n");
}

export function formatYijingHexagramBlock(
  locale: "en" | "zh",
  date = new Date(),
  hourBranch?: HourBranch | null,
) {
  const hex = getMeihuaHexagram(date, hourBranch);
  if (locale === "zh") {
    return [
      "【易经卦象 — 梅花易数起卦，须写入解读】",
      `- 本卦：${hex.name}（上${hex.upperTrigram}下${hex.lowerTrigram}）`,
      `- 动爻：第 ${hex.movingLine} 爻`,
      `- 起卦：${hex.method}`,
      `- 卦意参考：${hex.hint}`,
      "要求：结合面相气色与卦义，写 ## 易经卦象 一节（卦辞要义、事业财运人际、趋吉避凶、一句易经箴言）。",
    ].join("\n");
  }
  return [
    "[I Ching hexagram — Plum Blossom method, must appear in reading]",
    `- Hexagram: ${hex.name} (${hex.upperTrigram} over ${hex.lowerTrigram})`,
    `- Moving line: ${hex.movingLine}`,
    `- Method: ${hex.method}`,
    `- Theme: ${HEXAGRAM_HINT[hex.name]?.en ?? hex.hint}`,
    "Include ## I Ching section: judgment, career/wealth/relations, avoid/advance, one line motto.",
  ].join("\n");
}
