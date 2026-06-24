import type { FortuneProfile } from "@/types/fortune";
import { FORTUNE_TIMEZONE } from "@/lib/fortune/date";

export type HourBranch = "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";

export interface BaziPillars {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export function parseBaziFromNotes(notes: string | null): BaziPillars | null {
  if (!notes) return null;
  const year = notes.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])年/)?.[1];
  const month = notes.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])月/)?.[1];
  const day = notes.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])日/)?.[1];
  const hour = notes.match(/([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])时/)?.[1];
  if (!year || !month || !day || !hour) return null;
  return { year, month, day, hour };
}

const HOUR_RANGE_ZH: Record<HourBranch, string> = {
  子: "23:00–00:59",
  丑: "01:00–02:59",
  寅: "03:00–04:59",
  卯: "05:00–06:59",
  辰: "07:00–08:59",
  巳: "09:00–10:59",
  午: "11:00–12:59",
  未: "13:00–14:59",
  申: "15:00–16:59",
  酉: "17:00–18:59",
  戌: "19:00–20:59",
  亥: "21:00–22:59",
};

const HOUR_META_ZH: Record<
  HourBranch,
  { element: string; trait: string; do: string[]; avoid: string[] }
> = {
  子: {
    element: "水",
    trait: "静水深流，宜内省布局",
    do: ["独处思考、整理计划", "写方案、做研究", "早睡养精"],
    avoid: ["冲动决策", "深夜硬撑", "情绪化争论"],
  },
  丑: {
    element: "土",
    trait: "厚积薄发，宜守成蓄势",
    do: ["处理细节与合同", "核对账目", "稳步推进旧项目"],
    avoid: ["贪快冒进", "开新战线", "忽视休息"],
  },
  寅: {
    element: "木",
    trait: "生发启动，宜开新局",
    do: ["启动关键任务", "约见贵人", "做对外沟通"],
    avoid: ["同时铺太多事", "忽视团队感受", "空喊愿景不落地"],
  },
  卯: {
    element: "木",
    trait: "晨光舒展，宜表达连接",
    do: ["开会、路演、谈合作", "写文案、做推广", "建立人脉"],
    avoid: ["独断专行", "过度承诺", "忽略后续执行"],
  },
  辰: {
    element: "土",
    trait: "龙潜待发，宜整合资源",
    do: ["整合资源、定流程", "团队分工", "做中期规划"],
    avoid: ["朝令夕改", "频繁换方向", "忽视现金流"],
  },
  巳: {
    element: "火",
    trait: "智慧外露，宜表达出击（Kayden 癸巳：伤官透，敢想敢做但易急）",
    do: ["谈合作、展示价值", "抓关键人、做决策", "上午高效推进核心事"],
    avoid: ["口舌争胜", "情绪赌博", "一次开太多会", "硬逼他人表态"],
  },
  午: {
    element: "火",
    trait: "阳气最盛，宜果断行动",
    do: ["拍板定案", "推进签约", "公开亮相"],
    avoid: ["意气用事", "过度消耗", "忽视细节条款"],
  },
  未: {
    element: "土",
    trait: "午后收束，宜落实执行",
    do: ["跟进落地", "催进度、对细节", "处理团队事务"],
    avoid: ["拖延", "回避困难对话", "开冗长无结论的会"],
  },
  申: {
    element: "金",
    trait: "收敛变革，宜谈判交易",
    do: ["谈价、回款、清债", "做数据分析", "优化流程"],
    avoid: ["高杠杆投机", "忽视合同风险", "对团队过于苛刻"],
  },
  酉: {
    element: "金",
    trait: "精炼总结，宜收尾复盘",
    do: ["复盘、写总结", "整理债务清单", "做减法"],
    avoid: ["临时加任务", "熬夜", "情绪性消费"],
  },
  戌: {
    element: "土",
    trait: "守库藏锋，宜守财稳局",
    do: ["守财、控支出", "巩固关系", "家庭/休息"],
    avoid: ["大额冲动支出", "远行奔波", "过度社交"],
  },
  亥: {
    element: "水",
    trait: "归藏养气，宜放松沉淀",
    do: ["休息、冥想", "轻量沟通", "为明日布局"],
    avoid: ["重大决策", "高强度谈判", "刷负面信息"],
  },
};

export function getChineseHourBranch(birthTime: string | null) {
  if (!birthTime) return null;
  const [hourText] = birthTime.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return null;
  if (hour >= 23 || hour < 1) return "子";
  if (hour < 3) return "丑";
  if (hour < 5) return "寅";
  if (hour < 7) return "卯";
  if (hour < 9) return "辰";
  if (hour < 11) return "巳";
  if (hour < 13) return "午";
  if (hour < 15) return "未";
  if (hour < 17) return "申";
  if (hour < 19) return "酉";
  if (hour < 21) return "戌";
  return "亥";
}

export function getCurrentHourBranch(date = new Date(), timezone = FORTUNE_TIMEZONE): HourBranch {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  return getChineseHourBranch(`${hour}:00`) ?? "子";
}

export function getBaziHourPillar(profile: FortuneProfile) {
  const fromNotes = parseBaziFromNotes(profile.notes);
  if (fromNotes?.hour) return fromNotes.hour;
  const branch = getChineseHourBranch(profile.birth_time);
  if (!branch) return null;
  return `${branch}时`;
}

export function formatHourGuidanceBlock(profile: FortuneProfile, locale: "en" | "zh") {
  const birthBranch = getChineseHourBranch(profile.birth_time);
  const currentBranch = getCurrentHourBranch();
  const baziHour = getBaziHourPillar(profile);

  if (locale !== "zh") {
    return [
      "[Hour branch guidance]",
      birthBranch ? `- Birth hour branch: ${birthBranch} (${HOUR_RANGE_ZH[birthBranch]})` : null,
      `- Current flow hour: ${currentBranch}`,
      baziHour ? `- Bazi hour pillar: ${baziHour}` : null,
      "Must include: what to do / what to avoid for birth hour × current hour.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines = ["【时辰指引 — 必须写入解读】"];

  if (baziHour && profile.birth_time) {
    const meta = birthBranch ? HOUR_META_ZH[birthBranch] : null;
    lines.push(
      `- 命格时辰：${baziHour}（${profile.birth_time}，${birthBranch ? HOUR_RANGE_ZH[birthBranch] : ""}）`,
    );
    if (meta) {
      lines.push(`- 命格时辰特质：${meta.trait}（${meta.element}）`);
    }
  } else if (!profile.birth_time) {
    lines.push("- ⚠️ 用户未填出生时间 — 请提醒补填时辰，解读仅用今日流时");
  }

  const flowMeta = HOUR_META_ZH[currentBranch];
  lines.push(
    `- 今日流时：${currentBranch}时（${HOUR_RANGE_ZH[currentBranch]}，${flowMeta.element}）`,
    `- 流时特质：${flowMeta.trait}`,
    "",
    "解读中必须单独写 ## 时辰能量、## 此时辰宜做、## 此时辰宜避：",
    "命格时辰宜做参考：" + (birthBranch ? HOUR_META_ZH[birthBranch].do.join("；") : "—"),
    "命格时辰宜避参考：" + (birthBranch ? HOUR_META_ZH[birthBranch].avoid.join("；") : "—"),
    "今日流时宜做参考：" + flowMeta.do.join("；"),
    "今日流时宜避参考：" + flowMeta.avoid.join("；"),
    "",
    "要求：结合命格时辰 × 今日流时 × 八字/卦象，给出具体可执行事项，不要空泛。",
  );

  return lines.join("\n");
}

export { getChineseHourBranch as getHourBranchFromTime };
