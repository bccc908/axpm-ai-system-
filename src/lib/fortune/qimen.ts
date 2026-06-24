import { FORTUNE_TIMEZONE } from "@/lib/fortune/date";
import {
  getBaziHourPillar,
  getChineseHourBranch,
  getCurrentHourBranch,
  type HourBranch,
} from "@/lib/fortune/hour";
import type { FortuneProfile } from "@/types/fortune";

const EIGHT_GATES = ["休", "生", "伤", "杜", "景", "死", "惊", "开"] as const;
const NINE_STARS = ["天蓬", "天芮", "天冲", "天辅", "天禽", "天心", "天柱", "天任", "天英"] as const;
const EIGHT_DEITIES = ["值符", "腾蛇", "太阴", "六合", "白虎", "玄武", "九地", "九天"] as const;

const GATE_MEANING_ZH: Record<string, string> = {
  休: "休门主休养谋划，宜静思布局",
  生: "生门主生发求财，宜开拓新局",
  伤: "伤门主竞争损伤，宜慎争和",
  杜: "杜门主闭塞隐藏，宜守秘蓄势",
  景: "景门主文书名声，宜展示表达",
  死: "死门主终结收束，宜止损复盘",
  惊: "惊门主突发变动，宜防口舌惊吓",
  开: "开门主开创通达，宜谈判启动",
};

const STAR_MEANING_ZH: Record<string, string> = {
  天蓬: "天蓬星 — 智谋冒险，宜谋略不宜莽进",
  天芮: "天芮星 — 病符口舌，宜健康与沟通",
  天冲: "天冲星 — 冲动行动，宜果断出击",
  天辅: "天辅星 — 文昌贵人，宜学习策划",
  天禽: "天禽星 — 中宫统摄，宜居中协调",
  天心: "天心星 — 医药决策，宜医者自医",
  天柱: "天柱星 — 破败口舌，宜守不宜攻",
  天任: "天任星 — 稳重承载，宜守成积累",
  天英: "天英星 — 文明光彩，宜曝光演讲",
};

const HOUR_INDEX: Record<HourBranch, number> = {
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

function hkMonthDay(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: FORTUNE_TIMEZONE,
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { month: get("month"), day: get("day") };
}

/** 简化时家奇门（娱乐参考，非专业排盘） */
export function getQimenHourPlate(date = new Date(), hourBranch?: HourBranch) {
  const branch = hourBranch ?? getCurrentHourBranch(date);
  const idx = HOUR_INDEX[branch];
  const { month, day } = hkMonthDay(date);
  const yangDun = month >= 12 || month <= 5;
  const ju = ((month + day) % 9) + 1;
  const gate = EIGHT_GATES[idx % 8];
  const star = NINE_STARS[idx % 9];
  const deity = EIGHT_DEITIES[idx % 8];
  const auspiciousDir = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"][idx % 8];

  return {
    branch,
    dun: yangDun ? ("阳遁" as const) : ("阴遁" as const),
    ju,
    gate,
    star,
    deity,
    auspiciousDir,
    gateHint: GATE_MEANING_ZH[gate],
    starHint: STAR_MEANING_ZH[star],
  };
}

export function formatQimenBlock(
  profile: FortuneProfile,
  locale: "en" | "zh",
  date = new Date(),
) {
  const flow = getQimenHourPlate(date);
  const birthBranch = getChineseHourBranch(profile.birth_time);
  const birthPlate = birthBranch ? getQimenHourPlate(date, birthBranch) : null;
  const baziHour = getBaziHourPillar(profile);

  if (locale === "zh") {
    const lines = [
      "【奇门遁甲 — 时家奇门概要，须写入解读】",
      `- 今日流时：${flow.branch}时 · ${flow.dun}${flow.ju}局`,
      `- 流时八门：${flow.gate}门（${flow.gateHint}）`,
      `- 流时九星：${flow.starHint}`,
      `- 流时八神：${flow.deity}`,
      `- 参考吉方：${flow.auspiciousDir}`,
    ];
    if (birthPlate && profile.birth_time) {
      lines.push(
        `- 命格时辰：${baziHour ?? birthBranch + "时"}（${profile.birth_time}）`,
        `- 命时八门：${birthPlate.gate}门 · 九星${birthPlate.star}`,
        "要求：结合命格时辰奇门 × 今日流时奇门 × 面相宫位，写 ## 奇门遁甲 一节（门星神、方位、宜做宜避）。",
      );
    } else {
      lines.push(
        "- ⚠️ 未填出生时间 — 仅用今日流时奇门，请提醒补填时辰",
        "要求：写 ## 奇门遁甲 一节（门星神、方位、宜做宜避）。",
      );
    }
    return lines.join("\n");
  }

  const lines = [
    "[Qimen Dunjia — simplified hour plate, must appear in reading]",
    `- Flow hour: ${flow.branch} · ${flow.dun} ju ${flow.ju}`,
    `- Gate: ${flow.gate} — ${flow.gateHint}`,
    `- Star: ${flow.starHint}`,
    `- Deity: ${flow.deity}`,
    `- Auspicious direction: ${flow.auspiciousDir}`,
  ];
  if (birthPlate && profile.birth_time) {
    lines.push(
      `- Birth hour: ${profile.birth_time} · gate ${birthPlate.gate} · star ${birthPlate.star}`,
      "Include ## Qimen section: gate/star/deity, direction, do/avoid.",
    );
  } else {
    lines.push("Birth time missing — flow hour only. Include ## Qimen section.");
  }
  return lines.join("\n");
}
