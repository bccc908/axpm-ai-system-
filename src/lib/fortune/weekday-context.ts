import { FORTUNE_TIMEZONE } from "@/lib/fortune/date";

export type WeekdayProfile = {
  weekdayZh: string;
  weekdayEn: string;
  dayOfWeek: number;
  isWeekend: boolean;
  /** Likely real-world scene for Kayden */
  scene: string;
  primaryActions: string[];
  avoidCliches: string[];
  /** Wealth section angle — must differ from generic "非今日落袋" */
  wealthAngle: string;
  /** Concrete hour slots to mention */
  bestHours: string[];
  titleMotifHints: string[];
};

function hkWeekday(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { timeZone: FORTUNE_TIMEZONE, weekday: "long" });
  const weekdayZh = date.toLocaleDateString("zh-CN", { timeZone: FORTUNE_TIMEZONE, weekday: "long" });
  const dayOfWeek = new Date(
    date.toLocaleString("en-US", { timeZone: FORTUNE_TIMEZONE }),
  ).getDay();
  return { weekday, weekdayZh, dayOfWeek, isWeekend: dayOfWeek === 0 || dayOfWeek === 6 };
}

const PROFILES: Record<number, Omit<WeekdayProfile, "weekdayZh" | "weekdayEn" | "dayOfWeek" | "isWeekend">> = {
  0: {
    scene: "周日偏休息、回血、轻度规划；不宜硬排外务",
    primaryActions: ["睡眠与运动补能", "下周三件要事写清单", "家人/自我对话，不逼决策"],
    avoidCliches: ["冲业绩", "逼对方表态", "熬夜赶工"],
    wealthAngle: "周日不写落袋，宜梳理下周回款节点与待催清单",
    bestHours: ["辰时(7-9) 散步理清思路", "酉时(17-19) 写下周计划"],
    titleMotifHints: ["回血", "收心", "下周预排"],
  },
  1: {
    scene: "周一启动周计划，宜定优先级、派任务",
    primaryActions: ["济南团队本周三件事定稿", "ICCI 一条跟进线启动", "AXPM 只留一个技术卡点"],
    avoidCliches: ["同时开五条战线", "情绪性全员会"],
    wealthAngle: "周一重排优先级，不是谈价日；写清本周可能回款的一条线即可",
    bestHours: ["巳时(9-11) 排任务", "申时(15-17) 约关键人"],
    titleMotifHints: ["开局", "定锚", "派活"],
  },
  2: {
    scene: "周二执行日，宜推进已定的单线任务",
    primaryActions: ["跟进昨天派下去的事", "资料补齐再谈", "平台小修一项"],
    avoidCliches: ["临时改全盘计划", "无准备见大客户"],
    wealthAngle: "执行比谈价重要；有进展比有预期更接近财",
    bestHours: ["巳时(9-11) 深度执行", "午时(11-13) 简短对齐"],
    titleMotifHints: ["推进", "落地", "补齐"],
  },
  3: {
    scene: "周三中段，宜检查偏差、微调",
    primaryActions: ["复盘周中进度", "卡住的事换路径", "团队一对一"],
    avoidCliches: ["全盘否定", "加新战线"],
    wealthAngle: "宜看现金流节奏，不宜冲动追加投入",
    bestHours: ["巳时(9-11) 复盘", "未时(13-15) 沟通"],
    titleMotifHints: ["校正", "微调", "中段检"],
  },
  4: {
    scene: "周四宜外联、见关键人（若已约）",
    primaryActions: ["约好的对齐照常", "展示资料包", "书面确认下一步"],
    avoidCliches: ["无主题饭局", "空泛 networking"],
    wealthAngle: "可谈合作框架，落袋仍看后续；写清「今日产出物」",
    bestHours: ["巳时(9-11) 见关键人", "申时(15-17) 发纪要"],
    titleMotifHints: ["对齐", "展示", "确认"],
  },
  5: {
    scene: "周五收束，宜收尾、发纪要、不新开大坑",
    primaryActions: ["本周事项打勾", "发周报/纪要", "周末前留空白"],
    avoidCliches: ["周五下午开新大战", "情绪性承诺"],
    wealthAngle: "收尾清单比谈新钱更值；记录待催项",
    bestHours: ["巳时(9-11) 收尾", "酉时(17-19) 周报"],
    titleMotifHints: ["收束", "纪要", "留白"],
  },
  6: {
    scene: "周六在家整理资源、复盘、内务；大概率不外出见客",
    primaryActions: [
      "复盘本周济南/ICCI/AXPM 各一件事",
      "整理资料与文件夹（团队名单、合作资料）",
      "梳理待办，不写空话",
    ],
    avoidCliches: ["借力而上", "谈合作", "约茶吃饭", "主动找贵人", "非今日落袋（若与昨日同句则禁止）"],
    wealthAngle:
      "周六是整理型财运：清点资源、归档资料、列清下周催款项——不是落袋日，勿重复写「非今日落袋」套话",
    bestHours: ["巳时(9-11) 集中整理资料", "未时(13-15) 复盘笔记"],
    titleMotifHints: ["整理", "复盘", "内务", "梳理名单"],
  },
};

export function getWeekdayProfile(date = new Date(), locale: "en" | "zh" = "zh"): WeekdayProfile {
  const { weekday, weekdayZh, dayOfWeek, isWeekend } = hkWeekday(date);
  const base = PROFILES[dayOfWeek] ?? PROFILES[1];
  return {
    weekdayZh,
    weekdayEn: weekday,
    dayOfWeek,
    isWeekend,
    ...base,
    scene: locale === "en" ? translateScene(base.scene) : base.scene,
    primaryActions:
      locale === "en"
        ? base.primaryActions.map(translateScene)
        : base.primaryActions,
    avoidCliches:
      locale === "en" ? base.avoidCliches.map(translateScene) : base.avoidCliches,
    wealthAngle: locale === "en" ? translateScene(base.wealthAngle) : base.wealthAngle,
    bestHours: locale === "en" ? base.bestHours.map(translateScene) : base.bestHours,
    titleMotifHints: base.titleMotifHints,
  };
}

function translateScene(zh: string): string {
  // Minimal EN mirror for customer locale; Kayden uses zh primarily
  const map: Record<string, string> = {
    "周六在家整理资源、复盘、内务；大概率不外出见客": "Sat: home admin, review, files — unlikely outbound meetings",
    "周日偏休息、回血、轻度规划；不宜硬排外务": "Sun: rest, light planning — no forced outreach",
  };
  return map[zh] ?? zh;
}

export function formatWeekdayContextBlock(profile: WeekdayProfile, locale: "en" | "zh"): string {
  if (locale === "zh") {
    return [
      "【星期场景锚定 — 必须遵守，卦象须落在此场景上】",
      `- 今日：${profile.weekdayZh}${profile.isWeekend ? "（周末）" : ""}`,
      `- 真实场景：${profile.scene}`,
      `- 宜写进 ✅ 的行动：${profile.primaryActions.join("；")}`,
      `- 今日禁止套话：${profile.avoidCliches.join("、")}`,
      `- 财运角度（勿与近3日重复）：${profile.wealthAngle}`,
      `- 建议写明的时辰：${profile.bestHours.join("；")}`,
      `- title 副标题可参考意象（勿用「借力而上」除非周四且确有外联）：${profile.titleMotifHints.join(" / ")}`,
      "- 卦象解读：先问「这个卦在今日场景下是什么意思」，再写；益卦在周末=整理增益、内功，不是外出借力",
    ].join("\n");
  }
  return [
    `[Weekday anchor] ${profile.weekdayEn}${profile.isWeekend ? " (weekend)" : ""}`,
    `Scene: ${profile.scene}`,
    `Do: ${profile.primaryActions.join("; ")}`,
    `Avoid clichés: ${profile.avoidCliches.join(", ")}`,
    `Wealth angle: ${profile.wealthAngle}`,
    `Hours: ${profile.bestHours.join("; ")}`,
  ].join("\n");
}
