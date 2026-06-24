import "server-only";

import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { readAppSettings } from "@/lib/finance/settings";
import {
  getMarketKnowledgeBrief,
  type MarketKnowledgeCategory,
} from "@/lib/ai/market-knowledge";
import {
  buildSearchQuery,
  formatSearchResultsForPrompt,
  resolveMarketSearchPlan,
  searchWeb,
  type MarketSearchMode,
} from "@/lib/ai/web-search";

export type MarketAdvisorMode = "market" | "data" | "copy";

const MODE_GUIDE: Record<MarketAdvisorMode, string> = {
  market:
    "MODE: Marketing strategist — channel strategy, positioning, competitor angles, campaign ideas, funnel, IB growth.",
  data:
    "MODE: Data analyst — read numbers carefully. Summarize trends, compare columns, flag outliers, estimate ROI.",
  copy:
    "MODE: Content creator — Douyin/XHS hooks, scripts, captions, hashtags. Kayden voice.",
};

const DATA_OUTPUT_FORMAT = `
OUTPUT FORMAT (data mode — follow strictly):
## 核心结论（1-2句）
## 关键数据发现
- 每条：指标 + 数字 + 含义（引用文件名/列名）
## 数据明细表（必填 — 至少 1 个 Markdown 表格）
- 用上传文件里的真实数字，不要只写 bullet
- 格式示例：
| 平台/指标 | 数值 | 单位 | 来源文件 |
| TMGM 6月奖励上限 | 7000 | USD | 2026 TMGM六月...pdf |
| Moneta NND | 3000 | USD | ... |
- 对比类问题：同一表格里并列多平台/多月份
- 多维度可拆成 2 个小表（如「奖励阶梯表」「手数要求表」）
## 图表建议（3-7个）
- 每个图表一行：图表类型（柱状/折线/饼图等）+ 数据维度 + 业务解读
## 行动建议
- 3条可执行建议

IMPORTANT: Do NOT tell user to copy data into Excel manually. Tell them to click **「生成数据图表 PPT」** — PPT 含图表 + 明细总表 + CSV。`;

const MARKET_OUTPUT_FORMAT = `
OUTPUT FORMAT (market mode — follow strictly):
## 结论（1-2句，直接回答用户问题）
## 依据（引用上传文件中的事实/数字，标注文件名）
## 策略建议
- 3-5条，每条：动作 + 原因 + 预期效果
## 销售话术（可直接复制）
- 2-3段短话术，口语化，适合微信/电话
## 风险与合规
- 1-2条底线提醒

Style: 像 Kayden 给团队做 briefing，不要空话、不要「综上所述」、不要重复用户问题。`;

export async function buildMarketAdvisorSystemPrompt(
  mode: MarketAdvisorMode,
  searchContext?: string,
): Promise<string> {
  const settings = await readAppSettings();
  const persona = settings.socialMarketingPrompt?.trim() ?? "";
  const knowledgeAll = await getMarketKnowledgeBrief("all");
  const knowledgeMarket = await getMarketKnowledgeBrief("market");
  const knowledgeData = await getMarketKnowledgeBrief("data");

  const knowledge =
    mode === "data"
      ? [knowledgeData, knowledgeMarket].filter(Boolean).join("\n\n")
      : mode === "market"
        ? knowledgeMarket || knowledgeAll
        : [knowledgeMarket, knowledgeData].filter(Boolean).join("\n\n") || knowledgeAll;

  const hasWebSearch = Boolean(searchContext?.trim());

  const parts = [
    "You are Kayden's Market AI Twin — senior market strategist for forex/IB/fintech.",
    "Speak as Kayden: direct, numbers-driven, boss-level thinking, zero fluff.",
    "Always match the user's language (中文 question → 中文 answer).",
    MODE_GUIDE[mode],
    "",
    "RULES:",
    "- Ground answers in UPLOADED FILES — cite file names and specific figures.",
    "- Never invent statistics not in the data. Never promise returns.",
    "- Use markdown headers (##) and bullet points for readability.",
    "- Each bullet must add new information — no filler.",
    "",
    ...(hasWebSearch
      ? [
          "WEB SEARCH IS ACTIVE — live Google results are appended below.",
          "- For external brokers (IC Markets, etc.): answer from WEB SEARCH RESULTS first.",
          "- For brokers already in UPLOADED KNOWLEDGE: use file facts (numbers, dates, tiers).",
          "- Comparison questions: web results for missing brokers + uploaded files for known brokers.",
          "- In ## 依据, cite source titles + URLs from search results AND uploaded file names.",
          "- Do NOT say you cannot browse or lookup — you already have search results.",
          "- Do NOT fall back to vague「行业经验」when search snippets contain facts.",
        ]
      : [
          "EXTERNAL BROKER / LIVE LOOKUP (IC Markets, etc.):",
          "- Live web search is OFF — you cannot fetch broker sites in real time.",
          "- First check UPLOADED KNOWLEDGE — list which broker files you already have.",
          "- If the requested broker is NOT in uploads: do NOT only say「做不到」.",
          "  → Tell user to turn on **「联网搜索」** or paste partner page text via **「粘贴平台资料」**.",
          "  → Offer to compare using uploaded Moneta/TMGM/BCR/RKX files while they add the missing broker.",
          "- If user agrees to「行业经验框架」, label it clearly as 非文件依据 · 仅供参考.",
        ]),
  ];

  if (mode === "market") {
    parts.push(MARKET_OUTPUT_FORMAT);
  }

  if (mode === "data") {
    parts.push(DATA_OUTPUT_FORMAT);
  }

  if (persona) {
    parts.push("", "KAYDEN PERSONA (follow strictly):", persona);
  }

  if (knowledge) {
    parts.push("", "UPLOADED KNOWLEDGE (use as primary source):", knowledge);
  } else {
    parts.push(
      "",
      "No files uploaded yet — answer from Kayden persona and ask user to upload market docs or CSV data for deeper analysis.",
    );
  }

  if (searchContext?.trim()) {
    parts.push("", searchContext.trim());
  }

  return parts.join("\n");
}

export async function chatMarketAdvisor(params: {
  mode: MarketAdvisorMode;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  useSearch?: boolean;
}): Promise<{
  content: string;
  fallback?: boolean;
  notice?: string;
  searchUsed?: boolean;
  searchQuery?: string;
  searchSources?: { title: string; url: string }[];
  searchMode?: MarketSearchMode;
  searchReasonZh?: string;
  searchReasonEn?: string;
}> {
  let searchContext = "";
  let searchUsed = false;
  let searchQuery: string | undefined;
  let searchSources: { title: string; url: string }[] | undefined;
  const searchPlan = await resolveMarketSearchPlan(params.message, params.useSearch);
  const searchMode = searchPlan.mode;
  const searchReasonZh = searchPlan.reasonZh;
  const searchReasonEn = searchPlan.reasonEn;

  if (searchPlan.useWeb) {
    searchQuery = buildSearchQuery(params.message, params.mode);
    try {
      const search = await searchWeb(searchQuery);
      if (search.results.length) {
        searchUsed = true;
        searchSources = search.results.map((r) => ({ title: r.title, url: r.url }));
        searchContext = formatSearchResultsForPrompt(search.results);
      }
    } catch (error) {
      console.warn("[Market Advisor] web search failed:", error);
    }
  }

  const system = await buildMarketAdvisorSystemPrompt(params.mode, searchContext);
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
  ];

  for (const turn of params.history ?? []) {
    if (turn.content.trim()) {
      messages.push({ role: turn.role, content: turn.content.trim() });
    }
  }

  messages.push({ role: "user", content: params.message.trim() });

  const result = await deepSeekChat({
    messages,
    temperature: modeTemperature(params.mode),
    ...(params.mode === "market" ? { maxTokens: 1400 } : {}),
    ...(params.mode === "data" ? { maxTokens: 1600 } : {}),
  });

  if (result.ok && result.content.trim()) {
    return {
      content: result.content.trim(),
      searchUsed,
      searchQuery,
      searchSources,
      searchMode,
      searchReasonZh,
      searchReasonEn,
    };
  }

  const brief = await getMarketKnowledgeBrief(params.mode === "data" ? "data" : "market");
  const fallback = getOfflineMarketReply(params.mode, params.message, brief);
  if (fallback) {
    return {
      content: fallback,
      fallback: true,
      notice:
        (!result.ok ? result.error : undefined) ??
        "DeepSeek unavailable — offline reply from uploaded files",
    };
  }

  return {
    content: !result.ok
      ? result.error
      : "AI 暂时不可用。请检查 DEEPSEEK_API_KEY，或先上传资料文件后再试。",
    fallback: true,
  };
}

function modeTemperature(mode: MarketAdvisorMode) {
  if (mode === "data") return 0.2;
  if (mode === "copy") return 0.75;
  return 0.5;
}

function getOfflineMarketReply(mode: MarketAdvisorMode, question: string, brief: string) {
  if (!brief || brief.length < 80) return null;

  const zh = /[\u4e00-\u9fff]/.test(question);
  const snippet = brief
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 20 && !l.startsWith("[") && !l.startsWith("---"))
    .slice(0, 3)
    .join(" ");

  if (!snippet) return null;

  if (mode === "data") {
    return zh
      ? `根据已上传的数据文件：${snippet.slice(0, 400)}…\n\n（离线模式 — 连接 DeepSeek 后可做更完整的数据分析）`
      : `From uploaded data: ${snippet.slice(0, 400)}…\n\n(Offline mode — connect DeepSeek for full analysis)`;
  }

  if (mode === "copy") {
    return zh
      ? `基于你的资料，可以这样开场：\n「${question.slice(0, 30)}？大多数人第一步就想错了。」\n\n要点参考：${snippet.slice(0, 200)}…\n\n（离线模式 — 连接 AI 后可生成完整口播稿）`
      : `Hook idea based on your files:\n"${question.slice(0, 40)}?"\n\nReference: ${snippet.slice(0, 200)}…`;
  }

  return zh
    ? `根据已上传的市场资料：${snippet.slice(0, 400)}…\n\n你想深入哪个方向 — 渠道、竞品还是转化？`
    : `Based on uploaded market docs: ${snippet.slice(0, 400)}…\n\nWhich angle — channels, competitors, or conversion?`;
}

export type { MarketKnowledgeCategory };
