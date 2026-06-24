import type { FortuneLuckyElements } from "@/types/fortune";

export type DailyReadingSnapshot = {
  title: string;
  summary: string | null;
  reading: string;
  fortune_date?: string | null;
  lucky?: Pick<FortuneLuckyElements, "color" | "number" | "keyword"> | null;
};

const CLICHE_PHRASES_ZH = [
  "借力而上",
  "非今日落袋",
  "抓关键人",
  "分批清债",
  "约茶",
  "谈合作",
  "利有攸往",
  "诸象同指",
  "六月是布局月",
];

function excerpt(text: string, max = 320) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

function sectionHeadings(reading: string) {
  return [...reading.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
}

export function buildDailyAntiRepeatBlock(
  recent: DailyReadingSnapshot[],
  locale: "en" | "zh",
): string | null {
  const daily = recent.filter((r) => r.fortune_date || r.title.includes("卦"));
  if (daily.length === 0) return null;

  if (locale !== "zh") {
    return [
      "[Anti-repeat — daily fortune must differ from recent days]",
      ...daily.slice(0, 5).map((r, i) => `${i + 1}. ${r.title}`),
      "Use a fresh opening, different section order, and new lucky elements.",
    ].join("\n");
  }

  const lines = [
    "【反重复 — 今日运程必须与近几日明显不同】",
    "近几日标题（禁止套用相同副标题意象/卦语）：",
    ...daily.slice(0, 5).map((r, i) => {
      const date = r.fortune_date ? ` (${r.fortune_date})` : "";
      return `${i + 1}. ${r.title}${date}`;
    }),
  ];

  const summaries = daily.map((r) => r.summary).filter(Boolean) as string[];
  if (summaries.length) {
    lines.push("", "近几日摘要（勿复述同一句）：", ...summaries.slice(0, 3).map((s) => `- ${s.slice(0, 100)}`));
  }

  const luckyUsed = daily
    .map((r) => r.lucky)
    .filter(Boolean)
    .map((l) => `${l?.keyword ?? "—"}/${l?.color ?? "—"}/${l?.number ?? "—"}`);
  if (luckyUsed.length) {
    lines.push("", `近几日幸运元素已用过（今日须换）：${luckyUsed.slice(0, 3).join(" · ")}`);
  }

  const headings = daily.flatMap((r) => sectionHeadings(r.reading));
  const hourSectionCount = headings.filter((h) => h.includes("时辰") || h.includes("此时辰")).length;
  if (hourSectionCount >= 2) {
    lines.push(
      "",
      "近几日「时辰」段出现过多 — 今日禁止写长段时辰模板，最多一句带过流时。",
    );
  }

  const icciMentions = daily.filter(
    (r) => r.reading.includes("ICCI") || r.reading.includes("济南"),
  ).length;
  if (icciMentions >= 2) {
    lines.push(
      "",
      "近几日已多次写 ICCI/济南 — 今日「你现在最需要注意」须换主轴：可深写 AXPM 或内务整理，ICCI/济南最多 1–2 句。",
    );
  }

  const banned: string[] = [];
  for (const phrase of CLICHE_PHRASES_ZH) {
    const hits = daily.filter((r) => r.reading.includes(phrase) || r.summary?.includes(phrase)).length;
    if (hits >= 2) banned.push(phrase);
  }
  if (banned.length) {
    lines.push("", `下列套话近几日已重复，今日禁止再出现：${banned.join("、")}`);
  }

  lines.push(
    "",
    "近一日正文节选（仅供对比，勿复制句式）：",
    excerpt(daily[0].reading, 400),
    "",
    "要求：换开篇角度、换财运表述、换一句卦语；星级与 ✅❌ 须对应当日真实场景。",
  );

  return lines.join("\n");
}

/** Rotate which sections lead after 今日卦象 */
export function dailySectionOrderHint(dayNum: number): string {
  const orders = [
    "今日卦象 → 核心提醒 → 事业运 → 财运 → 贵人运 → 心态 → 策略 → 三件事 → 卦语",
    "核心提醒（结论先行）→ 今日卦象 → 财运 → 事业运 → 策略 → 三件事 → 心态 → 卦语",
    "今日卦象 → 财运 → 核心提醒 → 贵人运 → 策略 → 三件事 → 事业运 → 卦语",
    "三件事（先写主轴项目）→ 今日卦象 → 事业运 → 财运 → 策略 → 心态 → 卦语",
  ];
  return `今日章节顺序：${orders[dayNum % orders.length]}（须遵守，勿每天同一顺序）`;
}
