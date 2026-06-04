import "server-only";

import { getOpenAI, getChatModel, openAiErrorMessage } from "@/lib/ai/client";
import { isOpenAIReachable } from "@/lib/ai/openai-reachable";
import type { AgentKnowledgeEntry } from "@/lib/ai/agent-knowledge";

const ANALYZE_TEXT_LIMIT = 14_000;

export type KnowledgeAnalysis = {
  summary: string;
  topics: string[];
  forCustomers: string[];
  mustNotSay: string[];
  fallback: boolean;
  analyzed_at: string;
};

function truncateForAnalysis(text: string) {
  if (text.length <= ANALYZE_TEXT_LIMIT) return text;
  return `${text.slice(0, ANALYZE_TEXT_LIMIT)}\n\n[…document truncated for analysis]`;
}

function extractBulletLines(text: string, max = 8) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter(
    (l) =>
      /^[-•*]\s/.test(l) ||
      /^\d+[\.\)、]/.test(l) ||
      l.includes("→") ||
      l.includes("：") && l.length < 120,
  );
  return bullets.slice(0, max);
}

/** Local summary when OpenAI is unavailable */
export function analyzeKnowledgeLocally(
  fileName: string,
  text: string,
): KnowledgeAnalysis {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines[0]?.slice(0, 200) ?? fileName;
  const bullets = extractBulletLines(text, 10);
  const topics: string[] = [];
  const mustNot: string[] = [];

  const zhDoc = /[\u4e00-\u9fff]/.test(text);
  const topicPatterns: [RegExp, string, string][] = [
    [/定位|一句话/, "Brand positioning", "品牌定位"],
    [/合规|红线|违法|监管/, "Compliance & red lines", "合规与红线"],
    [/返佣|收入|商业模式|变现/, "Business model", "商业模式"],
    [/平台|开户|导流|绑定/, "Platform matching", "平台匹配/绑定"],
    [/漏斗|产品|功能/, "Product funnel", "产品漏斗"],
    [/运营|冷启动|渠道/, "Growth & channels", "运营与获客"],
    [/入金|出金|存款|提款/, "Deposits & withdrawals", "入金出金"],
    [/客户|回复|话术/, "Customer communication", "客户沟通"],
  ];

  for (const [re, en, zh] of topicPatterns) {
    const label = zhDoc ? zh : en;
    if (re.test(text) && !topics.includes(label)) topics.push(label);
  }

  if (/不喊单|不承诺|非投资|风险提示/.test(text)) {
    mustNot.push(
      zhDoc ? "不喊单、不承诺收益，附风险提示" : "No guaranteed returns or trade signals",
    );
  }
  if (/币圈|加密|外汇保证金/.test(text)) {
    mustNot.push(
      zhDoc
        ? "不对大陆用户导流币圈/离岸外汇开户"
        : "Careful with crypto/offshore FX referrals (compliance)",
    );
  }
  if (/情绪|冷静期/.test(text)) {
    mustNot.push(
      zhDoc ? "用户情绪极端时不推开户/导流" : "Do not push signup when user is emotional",
    );
  }

  const forCustomers = bullets.length
    ? bullets.slice(0, 6)
    : lines.slice(1, 7).map((l) => l.slice(0, 100));

  const summary = [
    `📄 ${fileName}`,
    "",
    zhDoc ? `**文档开头：** ${title}` : `**Document opening:** ${title}`,
    "",
    topics.length
      ? zhDoc
        ? `**识别主题：** ${topics.join(" · ")}`
        : `**Topics detected:** ${topics.join(" · ")}`
      : "",
    "",
    zhDoc ? "**从文档提取的要点：**" : "**Key points extracted (from document):**",
    ...forCustomers.map((b) => `• ${b.replace(/^[-•*]\s*/, "")}`),
    "",
    zhDoc
      ? "⚠️ 深度 AI 分析不可用（网络）。回复仍会使用完整文档原文 + 以上大纲。"
      : "⚠️ AI deep analysis unavailable (network). Replies use raw document text + this outline.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary,
    topics,
    forCustomers,
    mustNotSay: mustNot,
    fallback: true,
    analyzed_at: new Date().toISOString(),
  };
}

async function analyzeKnowledgeWithOpenAI(
  fileName: string,
  text: string,
  manualBrief?: string,
): Promise<KnowledgeAnalysis> {
  const openai = getOpenAI();
  if (!openai) {
    return analyzeKnowledgeLocally(fileName, text);
  }

  const reachable = await isOpenAIReachable();
  if (!reachable) {
    return analyzeKnowledgeLocally(fileName, text);
  }

  const doc = truncateForAnalysis(text);
  const extra = manualBrief?.trim()
    ? `\n\nTeam instructions already set:\n${manualBrief.trim().slice(0, 2000)}`
    : "";

  try {
    const response = await openai.chat.completions.create({
      model: getChatModel(),
      messages: [
        {
          role: "system",
          content:
            "You analyze training documents for a customer reply AI agent. " +
            "Output JSON only. Be accurate — only state what is in the document. " +
            "Use the same language as the document (Chinese doc → Chinese fields).",
        },
        {
          role: "user",
          content: `Analyze this training file for a customer-service reply bot.

File name: ${fileName}
${extra}

Document:
${doc}

Return JSON:
{
  "summary": "2-4 paragraph plain-text summary of what the bot should know",
  "topics": ["topic1", "topic2", ...],
  "forCustomers": ["what to tell customers — 5-8 bullets"],
  "mustNotSay": ["things the bot must never say or do — 3-6 bullets"]
}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1200,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      summary?: string;
      topics?: string[];
      forCustomers?: string[];
      mustNotSay?: string[];
    };

    const summary = String(parsed.summary ?? "").trim();
    if (!summary) {
      return analyzeKnowledgeLocally(fileName, text);
    }

    return {
      summary,
      topics: (parsed.topics ?? []).map(String).filter(Boolean).slice(0, 12),
      forCustomers: (parsed.forCustomers ?? []).map(String).filter(Boolean).slice(0, 10),
      mustNotSay: (parsed.mustNotSay ?? []).map(String).filter(Boolean).slice(0, 10),
      fallback: false,
      analyzed_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[analyzeKnowledgeWithOpenAI]", error);
    const local = analyzeKnowledgeLocally(fileName, text);
    local.summary += `\n\n(${openAiErrorMessage(error)})`;
    return local;
  }
}

export async function analyzeKnowledgeFile(
  entry: AgentKnowledgeEntry,
  manualBrief?: string,
): Promise<KnowledgeAnalysis> {
  return analyzeKnowledgeWithOpenAI(entry.name, entry.text, manualBrief);
}

export async function analyzeAllKnowledgeFiles(
  files: AgentKnowledgeEntry[],
  manualBrief?: string,
): Promise<KnowledgeAnalysis> {
  if (files.length === 0) {
    return {
      summary: "",
      topics: [],
      forCustomers: [],
      mustNotSay: [],
      fallback: true,
      analyzed_at: new Date().toISOString(),
    };
  }

  if (files.length === 1) {
    return analyzeKnowledgeFile(files[0], manualBrief);
  }

  const combinedName = `${files.length} training files`;
  const combinedText = files
    .map((f) => `=== ${f.name} ===\n${f.text}`)
    .join("\n\n");

  return analyzeKnowledgeWithOpenAI(combinedName, combinedText, manualBrief);
}

export function formatAnalysisForDisplay(analysis: KnowledgeAnalysis) {
  const parts: string[] = [analysis.summary];

  if (analysis.topics.length) {
    parts.push("", "**Topics:** " + analysis.topics.join(" · "));
  }
  if (analysis.forCustomers.length) {
    parts.push("", "**Will use when replying:**");
    analysis.forCustomers.forEach((t) => parts.push(`• ${t}`));
  }
  if (analysis.mustNotSay.length) {
    parts.push("", "**Will avoid:**");
    analysis.mustNotSay.forEach((t) => parts.push(`• ${t}`));
  }

  return parts.join("\n");
}
