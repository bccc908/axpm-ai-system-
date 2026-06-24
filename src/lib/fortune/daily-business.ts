/** Daily fortune as CEO decision brief — structure, detection, fallback helpers. */

export function isBusinessDailyReading(reading: string): boolean {
  if (!reading?.trim()) return false;
  return (
    /^##\s*执行摘要/m.test(reading) &&
    /^##\s*业务优先级/m.test(reading) &&
    /^##\s*今日行动/m.test(reading)
  );
}

export function dailyBusinessStructureGuide(locale: "en" | "zh"): string {
  if (locale !== "zh") {
    return [
      "reading must follow this executive brief structure (## headings):",
      "## Report date",
      "## Executive summary (blockquote: one strategic judgment)",
      "## Situation (hexagram as decision frame, business language only)",
      "## Business priorities (### P0/P1/P2 · project name — goal / today action / done-when)",
      "## Domain assessment (### Execution / Cash flow / Network — ⭐ rating + 2-3 lines)",
      "## Risks & constraints (blockquote core risk + bullet list)",
      "## Today's action list (✅ do / ❌ avoid)",
      "## Decision anchor (blockquote one line)",
      "## 2–3 week roadmap (this week / next week / by month-end)",
      "",
      "Tone: CEO daily brief. No x/10 scores, no hour-by-hour templates.",
    ].join("\n");
  }

  return [
    "reading 必须按以下「商业决策简报」结构输出（## 一级标题，### 三级标题）：",
    "",
    "## 报告日期",
    "（公历年月日 + 星期 + 香港时间）",
    "",
    "## 执行摘要",
    "（blockquote 一句：今日战略判断，像董事会一页纸摘要）",
    "",
    "## 态势研判",
    "（卦象仅作「决策框架/隐喻」，用商业语言写：资源分布、执行节奏、外部/内部阻力；2-3 段，禁止大段玄学术语堆砌）",
    "",
    "## 业务优先级",
    "（三条业务线须用 ### P0 / P1 / P2 标注，每条含三行：）",
    "- **目标**：今日要推进的结果",
    "- **今日动作**：1-2 条可执行事项",
    "- **完成标准**：怎样算今天过关",
    "（P0 写深，P1/P2 可简；对应济南团队 / ICCI 合作 / AXPM 平台）",
    "",
    "## 分项评估",
    "### 事业推进 ⭐（1-5，可半星）",
    "### 资金与现金流 ⭐",
    "### 人脉与资源 ⭐",
    "（每段：现状判断 + blockquote 一句 + 与 Kayden 当前阶段相关的提醒）",
    "",
    "## 风险与约束",
    "（blockquote 今日最大风险一句 + 2-4 条风险/合规/心态约束；可用 ❌ 标注禁止项）",
    "",
    "## 今日行动清单",
    "（✅ 必做 3-5 条 / ❌ 禁止 2-4 条，动词开头，可量化）",
    "",
    "## 决策锚点",
    "（blockquote 一句：今日拍板时回到这句话）",
    "",
    "## 阶段路线图",
    "（- **本周** / **下周** / **月底前** 各 1 句，给时间预期与里程碑）",
    "",
    "规范：",
    "- 定位 CEO 每日决策简报，不是算命文章",
    "- 用语：战略、优先级、ROI、风险敞口、对齐、闭环、回款节点、合规",
    "- 禁止：综合指数 x/10、时辰模板、感情运独立大段、★ 星级（只用 ⭐）",
    "- 450–650 字，段落短、信息密度高",
  ].join("\n");
}

export function dailyBusinessPersonaZh(): string {
  return [
    "【角色】Kayden 个人 CEO 每日决策顾问，输出规范的商业决策简报。",
    "【体例】对标董事会一页纸 / 高管日报：结论先行、优先级清晰、行动可验收。",
    "【玄学边界】梅花卦象仅作「决策框架/隐喻」，放在态势研判；不断语装神，不堆紫微/称骨/八字长文。",
    "【读者背景】",
    "- 八字：甲戌 · 丙寅 · 辛未 · 癸巳；生肖狗；数字 1/3/6/9 旺，缺 5/7/8",
    "- 2026 三线：济南团队、ICCI×济南合作、AXPM 平台",
    "- 忌讳：情绪交易、高杠杆、多线并行、无准备见大客户",
  ].join("\n");
}

const PROJECTS = ["济南团队", "ICCI 合作", "AXPM 平台"] as const;

export function rotateBusinessPriorities(dayNum: number) {
  const i = dayNum % 3;
  return {
    p0: PROJECTS[i],
    p1: PROJECTS[(i + 1) % 3],
    p2: PROJECTS[(i + 2) % 3],
  };
}

export function buildPrioritySection(
  rank: "P0" | "P1" | "P2",
  project: string,
  goal: string,
  action: string,
  done: string,
) {
  return [
    `### ${rank} · ${project}`,
    `- **目标**：${goal}`,
    `- **今日动作**：${action}`,
    `- **完成标准**：${done}`,
  ].join("\n");
}
