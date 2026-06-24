import type { FortuneProfile } from "@/types/fortune";
import { formatChengguBlock, getChengguReading } from "@/lib/fortune/chenggu";
import {
  formatHourGuidanceBlock,
  getBaziHourPillar,
  getChineseHourBranch,
  getCurrentHourBranch,
  parseBaziFromNotes,
} from "@/lib/fortune/hour";
import { formatZiweiBlock, getZiweiChart, type ZiweiChart } from "@/lib/fortune/ziwei";

export { getChineseHourBranch, parseBaziFromNotes } from "@/lib/fortune/hour";

const ZODIAC_EN = [
  "Rat",
  "Ox",
  "Tiger",
  "Rabbit",
  "Dragon",
  "Snake",
  "Horse",
  "Goat",
  "Monkey",
  "Rooster",
  "Dog",
  "Pig",
] as const;

const ZODIAC_ZH = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"] as const;

export function getChineseZodiac(birthDate: string, locale: "en" | "zh" = "en") {
  const year = new Date(birthDate).getFullYear();
  if (Number.isNaN(year)) return null;
  const index = ((year - 4) % 12 + 12) % 12;
  return locale === "zh" ? ZODIAC_ZH[index] : ZODIAC_EN[index];
}

type SignRange = {
  en: string;
  zh: string;
  from: [number, number];
  to: [number, number];
};

const WESTERN_SIGNS: SignRange[] = [
  { en: "Capricorn", zh: "摩羯座", from: [12, 22], to: [1, 19] },
  { en: "Aquarius", zh: "水瓶座", from: [1, 20], to: [2, 18] },
  { en: "Pisces", zh: "双鱼座", from: [2, 19], to: [3, 20] },
  { en: "Aries", zh: "白羊座", from: [3, 21], to: [4, 19] },
  { en: "Taurus", zh: "金牛座", from: [4, 20], to: [5, 20] },
  { en: "Gemini", zh: "双子座", from: [5, 21], to: [6, 20] },
  { en: "Cancer", zh: "巨蟹座", from: [6, 21], to: [7, 22] },
  { en: "Leo", zh: "狮子座", from: [7, 23], to: [8, 22] },
  { en: "Virgo", zh: "处女座", from: [8, 23], to: [9, 22] },
  { en: "Libra", zh: "天秤座", from: [9, 23], to: [10, 22] },
  { en: "Scorpio", zh: "天蝎座", from: [10, 23], to: [11, 21] },
  { en: "Sagittarius", zh: "射手座", from: [11, 22], to: [12, 21] },
];

function dayOfYear(month: number, day: number) {
  return month * 100 + day;
}

function inSignRange(month: number, day: number, from: [number, number], to: [number, number]) {
  const value = dayOfYear(month, day);
  const fromValue = dayOfYear(from[0], from[1]);
  const toValue = dayOfYear(to[0], to[1]);
  if (fromValue <= toValue) {
    return value >= fromValue && value <= toValue;
  }
  return value >= fromValue || value <= toValue;
}

export function getWesternZodiacSign(birthDate: string, locale: "en" | "zh" = "en") {
  const parsed = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();
  const sign = WESTERN_SIGNS.find((item) => inSignRange(month, day, item.from, item.to));
  if (!sign) return null;
  return locale === "zh" ? sign.zh : sign.en;
}

export function getLifePathNumber(birthDate: string) {
  const digits = birthDate.replace(/\D/g, "");
  if (!digits) return null;
  let sum = [...digits].reduce((acc, digit) => acc + Number(digit), 0);
  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
    sum = [...String(sum)].reduce((acc, digit) => acc + Number(digit), 0);
  }
  return sum;
}

export interface FortuneSystemsInfo {
  chineseZodiac: string | null;
  westernSign: string | null;
  lifePath: number | null;
  hourBranch: string | null;
  baziHour: string | null;
  currentHourBranch: string;
  bazi: ReturnType<typeof parseBaziFromNotes>;
  chenggu: ReturnType<typeof getChengguReading>;
  ziwei: ZiweiChart | null;
}

export function getFortuneSystems(profile: FortuneProfile, locale: "en" | "zh"): FortuneSystemsInfo {
  return {
    chineseZodiac: profile.birth_date ? getChineseZodiac(profile.birth_date, locale) : null,
    westernSign: profile.birth_date ? getWesternZodiacSign(profile.birth_date, locale) : null,
    lifePath: profile.birth_date ? getLifePathNumber(profile.birth_date) : null,
    hourBranch: getChineseHourBranch(profile.birth_time),
    baziHour: getBaziHourPillar(profile),
    currentHourBranch: getCurrentHourBranch(),
    bazi: parseBaziFromNotes(profile.notes),
    chenggu: getChengguReading(profile, locale),
    ziwei: getZiweiChart(profile, locale),
  };
}

function stripZiweiArchiveNotes(notes: string | null) {
  if (!notes) return null;
  const marker = "【紫微档案】";
  const idx = notes.indexOf(marker);
  if (idx === -1) return notes;
  const trimmed = notes.slice(0, idx).trim();
  return trimmed || null;
}

export function formatFortuneSystemsBlock(
  profile: FortuneProfile,
  locale: "en" | "zh",
  options?: { compact?: boolean },
) {
  const compact = options?.compact === true;
  const systems = getFortuneSystems(profile, locale);
  const chengguBlock = formatChengguBlock(profile, locale);
  const ziweiBlock = formatZiweiBlock(profile, locale, compact);
  const hourBlock = formatHourGuidanceBlock(profile, locale);
  const notes = compact ? stripZiweiArchiveNotes(profile.notes) : profile.notes;
  if (locale === "zh") {
    return [
      "【命理体系档案】",
      systems.chineseZodiac ? `- 生肖：${systems.chineseZodiac}` : null,
      systems.westernSign ? `- 太阳星座：${systems.westernSign}` : null,
      systems.lifePath ? `- 生命灵数：${systems.lifePath}` : null,
      systems.baziHour
        ? `- 八字时辰：${systems.baziHour}（出生 ${profile.birth_time ?? "—"}）`
        : profile.birth_time
          ? `- 出生时辰：${systems.hourBranch}时（${profile.birth_time}）`
          : null,
      `- 今日流时：${systems.currentHourBranch}时（香港时间此刻）`,
      systems.bazi
        ? `- 八字：${systems.bazi.year}年 · ${systems.bazi.month}月 · ${systems.bazi.day}日 · ${systems.bazi.hour}时`
        : null,
      ziweiBlock,
      chengguBlock,
      "",
      hourBlock,
      notes ? `- 个人备注：\n${notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "[Fortune systems profile]",
    systems.chineseZodiac ? `- Chinese zodiac: ${systems.chineseZodiac}` : null,
    systems.westernSign ? `- Sun sign: ${systems.westernSign}` : null,
    systems.lifePath ? `- Life path number: ${systems.lifePath}` : null,
    systems.hourBranch ? `- Birth hour branch: ${systems.hourBranch}` : null,
    systems.bazi
      ? `- Bazi: ${systems.bazi.year} / ${systems.bazi.month} / ${systems.bazi.day} / ${systems.bazi.hour}`
      : null,
    ziweiBlock,
    chengguBlock,
    notes ? `- Notes:\n${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
