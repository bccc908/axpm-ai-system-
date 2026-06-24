import "server-only";

import { deepSeekChat } from "@/lib/ai/deepseek-client";
import {
  analyzeKnowledgeLocally,
  type KnowledgeAnalysis,
} from "@/lib/ai/analyze-knowledge";
import type { MarketKnowledgeCategory } from "@/lib/ai/market-knowledge";

const ANALYZE_TEXT_LIMIT = 14_000;

function truncate(text: string) {
  if (text.length <= ANALYZE_TEXT_LIMIT) return text;
  return `${text.slice(0, ANALYZE_TEXT_LIMIT)}\n\n[…document truncated]`;
}

export async function analyzeMarketFile(
  fileName: string,
  text: string,
  category: MarketKnowledgeCategory,
): Promise<KnowledgeAnalysis> {
  const doc = truncate(text.trim());
  if (doc.length < 8 || doc.startsWith("[已储存文件:")) {
    return {
      summary: `📄 ${fileName}\n\n文件已储存。若需 AI 深度分析，请上传含可读文字的 PDF/Word/TXT/CSV。`,
      topics: [],
      forCustomers: [],
      mustNotSay: [],
      fallback: true,
      analyzed_at: new Date().toISOString(),
    };
  }

  const isData = category === "data";
  const system = isData
    ? `你是 Kayden 的资深市场数据分析师（10年+金融/外汇行业）。
输出要求：专业、有结构、有数字、可落地。只基于文档内容，不编造。中文输出。`
    : `你是 Kayden 的资深市场战略顾问（外汇/IB/金融科技背景）。
输出要求：像给老板看的内部分析报告——有结论、有对比、有动作、有合规边界。
只基于文档内容，不编造数字。中文输出。`;

  const userPrompt = isData
    ? `分析数据文件「${fileName}」：

${doc}

Return JSON only:
{
  "summary": "Markdown格式，必须包含以下小节（用 ## 标题）：\\n## 数据概况\\n（2-3句）\\n## 关键指标\\n（列出文档中的核心数字，带单位）\\n## 趋势与异常\\n（发现了什么）\\n## 建议动作\\n（3条，可执行）",
  "topics": ["5-8个标签"],
  "keyInsights": ["5-8条洞察，每条格式：【结论】+ 依据 + 建议"],
  "mustNotSay": ["合规红线"]
}`
    : `分析市场文档「${fileName}」：

${doc}

Return JSON only:
{
  "summary": "Markdown格式，必须包含以下小节（用 ## 标题）：\\n## Executive Summary\\n（3句话：这份文档是什么、对谁、核心价值）\\n## 核心卖点\\n（3-5条，带具体数字/条件）\\n## 竞争对比\\n（我们 vs 行业常规，表格思维：优势/差异/风险）\\n## 目标人群\\n（谁最适合、谁不适合）\\n## 渠道与打法\\n（2-3个优先渠道 + 为什么）",
  "topics": ["5-8个标签，如：返佣、IB裂变、区域中心"],
  "keyInsights": ["6-10条可落地动作，格式：【动作】具体做什么 → 预期效果。含销售话术片段"],
  "mustNotSay": ["3-5条合规红线，无则[]"]
}`;

  const result = await deepSeekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    json: true,
    temperature: 0.25,
    maxTokens: 2200,
  });

  if (!result.ok) {
    const local = analyzeKnowledgeLocally(fileName, text);
    local.summary = `⚠️ AI 分析暂不可用（${result.error}）\n\n${local.summary}`;
    local.fallback = true;
    return local;
  }

  try {
    const parsed = JSON.parse(result.content) as {
      summary?: string;
      topics?: string[];
      keyInsights?: string[];
      mustNotSay?: string[];
    };
    const summary = String(parsed.summary ?? "").trim();
    if (!summary) throw new Error("empty");

    return {
      summary: `📄 ${fileName}\n\n${summary}`,
      topics: (parsed.topics ?? []).map(String).filter(Boolean).slice(0, 12),
      forCustomers: (parsed.keyInsights ?? []).map(String).filter(Boolean).slice(0, 10),
      mustNotSay: (parsed.mustNotSay ?? []).map(String).filter(Boolean).slice(0, 8),
      fallback: false,
      analyzed_at: new Date().toISOString(),
    };
  } catch {
    const local = analyzeKnowledgeLocally(fileName, text);
    local.fallback = true;
    return local;
  }
}
