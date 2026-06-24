import "server-only";

import {
  getSerperApiKey,
  getTavilyApiKey,
  getWebSearchMaxResults,
  getWebSearchProvider,
  isWebSearchAutoEnabled,
  isWebSearchConfigured,
} from "@/lib/ai/web-search-config";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  content?: string;
};

export type WebSearchResponse = {
  query: string;
  provider: "tavily" | "serper" | "none";
  results: WebSearchResult[];
};

export { isWebSearchConfigured };

type BrokerDef = {
  key: string;
  label: string;
  pattern: RegExp;
  query: string;
};

const BROKER_DEFS: BrokerDef[] = [
  {
    key: "ic-markets",
    label: "IC Markets",
    pattern: /IC\s*Markets|icmarkets|\bICM\b/i,
    query: "IC Markets introducing broker partner program commission rebate",
  },
  {
    key: "tmgm",
    label: "TMGM",
    pattern: /TMGM/i,
    query: "TMGM IB partner program commission rebate policy",
  },
  {
    key: "moneta",
    label: "Moneta",
    pattern: /Moneta|NND/i,
    query: "Moneta Markets IB partner program commission rebate",
  },
  {
    key: "bcr",
    label: "BCR",
    pattern: /BCR/i,
    query: "BCR Markets IB partner program commission",
  },
  {
    key: "rkx",
    label: "RKX",
    pattern: /RKX|区域服务中心/i,
    query: "RKX IB partner regional service center program",
  },
  {
    key: "exness",
    label: "Exness",
    pattern: /Exness/i,
    query: "Exness partner program IB commission",
  },
  {
    key: "xm",
    label: "XM",
    pattern: /\bXM\b/i,
    query: "XM broker IB partner program commission",
  },
];

const BROKER_SEARCH = BROKER_DEFS.map(({ pattern, query }) => ({ pattern, query }));

const LIVE_LOOKUP_HINT =
  /搜索|查一下|查查|查询|官网|最新|实时|联网|网上|search|look up|find online|google/i;

export function buildSearchQuery(message: string, mode?: string): string {
  const trimmed = message.trim().slice(0, 400);
  const zh = /[\u4e00-\u9fff]/.test(trimmed);

  for (const broker of BROKER_SEARCH) {
    if (broker.pattern.test(trimmed)) {
      return broker.query;
    }
  }

  if (mode === "data") {
    return zh ? `${trimmed} 外汇 IB 数据 政策` : `${trimmed} forex IB data policy`;
  }
  if (mode === "copy") {
    return zh ? `${trimmed} 外汇 营销` : `${trimmed} forex marketing`;
  }
  return zh ? `${trimmed} 外汇 IB 代理 政策 返佣` : `${trimmed} forex IB partner program commission`;
}

export type MarketSearchMode = "local" | "web" | "hybrid" | "off";

export type MarketSearchPlan = {
  useWeb: boolean;
  mode: MarketSearchMode;
  reasonZh: string;
  reasonEn: string;
  mentionedBrokers: string[];
  localBrokers: string[];
  missingBrokers: string[];
};

function detectBrokersInText(text: string): BrokerDef[] {
  return BROKER_DEFS.filter((b) => b.pattern.test(text));
}

async function getUploadedBrokerKeys(): Promise<Set<string>> {
  const { listMarketKnowledgeFiles } = await import("@/lib/ai/market-knowledge");
  const files = await listMarketKnowledgeFiles();
  const keys = new Set<string>();

  for (const file of files) {
    const haystack = [
      file.name,
      file.text.slice(0, 4000),
      ...(file.analysis?.topics ?? []),
    ].join("\n");
    for (const broker of detectBrokersInText(haystack)) {
      keys.add(broker.key);
    }
  }

  return keys;
}

/** Smart routing: local files when enough coverage; Serper when broker missing or user wants live data. */
export async function resolveMarketSearchPlan(
  message: string,
  useSearch?: boolean,
): Promise<MarketSearchPlan> {
  const empty: MarketSearchPlan = {
    useWeb: false,
    mode: "local",
    reasonZh: "使用已上传资料",
    reasonEn: "Using uploaded files",
    mentionedBrokers: [],
    localBrokers: [],
    missingBrokers: [],
  };

  if (useSearch === false || !isWebSearchConfigured()) {
    return {
      ...empty,
      mode: useSearch === false ? "off" : "local",
      reasonZh: useSearch === false ? "已设为仅本地资料" : "联网搜索未配置",
      reasonEn: useSearch === false ? "Local files only" : "Web search not configured",
    };
  }

  const uploaded = await getUploadedBrokerKeys();
  const mentioned = detectBrokersInText(message);
  const mentionedKeys = mentioned.map((b) => b.key);
  const localBrokers = mentioned.filter((b) => uploaded.has(b.key)).map((b) => b.label);
  const missingBrokers = mentioned.filter((b) => !uploaded.has(b.key)).map((b) => b.label);
  const wantsLive = LIVE_LOOKUP_HINT.test(message);

  const base = {
    mentionedBrokers: mentioned.map((b) => b.label),
    localBrokers,
    missingBrokers,
  };

  if (wantsLive) {
    return {
      useWeb: true,
      mode: localBrokers.length > 0 && missingBrokers.length > 0 ? "hybrid" : "web",
      reasonZh:
        localBrokers.length > 0
          ? `检测到「最新/官网」需求 — 联网补充，本地已有 ${localBrokers.join("、")}`
          : "检测到联网查询需求 — 自动搜索",
      reasonEn:
        localBrokers.length > 0
          ? `Live lookup requested — web + local (${localBrokers.join(", ")})`
          : "Live lookup requested — searching web",
      ...base,
    };
  }

  if (missingBrokers.length > 0) {
    return {
      useWeb: true,
      mode: localBrokers.length > 0 ? "hybrid" : "web",
      reasonZh:
        localBrokers.length > 0
          ? `本地无 ${missingBrokers.join("、")} — 联网查找；${localBrokers.join("、")} 用上传文件`
          : `本地无 ${missingBrokers.join("、")} 资料 — 自动联网搜索`,
      reasonEn:
        localBrokers.length > 0
          ? `Missing local files for ${missingBrokers.join(", ")} — web search; ${localBrokers.join(", ")} from uploads`
          : `No local files for ${missingBrokers.join(", ")} — auto web search`,
      ...base,
    };
  }

  if (mentionedKeys.length > 0) {
    return {
      useWeb: false,
      mode: "local",
      reasonZh: `已上传 ${localBrokers.join("、")} 资料 — 使用本地文件`,
      reasonEn: `Using uploaded files for ${localBrokers.join(", ")}`,
      ...base,
    };
  }

  if (useSearch === true) {
    return {
      useWeb: true,
      mode: "web",
      reasonZh: "手动开启联网搜索",
      reasonEn: "Web search manually enabled",
      ...base,
    };
  }

  if (isWebSearchAutoEnabled() && /broker|外汇|IB|代理|返佣|platform|平台/i.test(message)) {
    return {
      useWeb: true,
      mode: "web",
      reasonZh: "行业问题且无本地命中 — 自动联网补充",
      reasonEn: "Industry question — auto web lookup",
      ...base,
    };
  }

  return empty;
}

export async function shouldWebSearch(message: string, useSearch?: boolean): Promise<boolean> {
  const plan = await resolveMarketSearchPlan(message, useSearch);
  return plan.useWeb;
}

export function formatSearchResultsForPrompt(results: WebSearchResult[]): string {
  if (!results.length) return "";
  const lines = results.map((r, i) => {
    const body = (r.content || r.snippet).trim().slice(0, 1200);
    return `[${i + 1}] ${r.title}\nURL: ${r.url}\n${body}`;
  });
  return [
    "WEB SEARCH RESULTS (use for external broker/policy facts — cite source URL; if conflict with UPLOADED KNOWLEDGE, prefer uploads for your own platforms):",
    lines.join("\n\n"),
  ].join("\n");
}

async function searchTavily(query: string): Promise<WebSearchResult[]> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) return [];

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: getWebSearchMaxResults(),
      include_answer: false,
    }),
  });

  if (!res.ok) {
    console.warn("[WebSearch Tavily]", res.status, await res.text().catch(() => ""));
    return [];
  }

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; snippet?: string }>;
  };

  return (data.results ?? [])
    .map((r) => ({
      title: String(r.title ?? "Result").trim(),
      url: String(r.url ?? "").trim(),
      snippet: String(r.snippet ?? r.content ?? "").trim().slice(0, 500),
      content: r.content ? String(r.content).trim() : undefined,
    }))
    .filter((r) => r.url.length > 8);
}

async function searchSerper(query: string): Promise<WebSearchResult[]> {
  const apiKey = getSerperApiKey();
  if (!apiKey) return [];

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: query,
      num: getWebSearchMaxResults(),
    }),
  });

  if (!res.ok) {
    console.warn("[WebSearch Serper]", res.status, await res.text().catch(() => ""));
    return [];
  }

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (data.organic ?? [])
    .map((r) => ({
      title: String(r.title ?? "Result").trim(),
      url: String(r.link ?? "").trim(),
      snippet: String(r.snippet ?? "").trim(),
    }))
    .filter((r) => r.url.length > 8);
}

export async function searchWeb(query: string): Promise<WebSearchResponse> {
  const q = query.trim().slice(0, 400);
  if (!q) return { query: q, provider: "none", results: [] };

  const providerPref = getWebSearchProvider();
  const order: Array<"tavily" | "serper"> =
    providerPref === "tavily"
      ? ["tavily", "serper"]
      : providerPref === "serper"
        ? ["serper", "tavily"]
        : getTavilyApiKey()
          ? ["tavily", "serper"]
          : ["serper", "tavily"];

  for (const provider of order) {
    const results =
      provider === "tavily" ? await searchTavily(q) : await searchSerper(q);
    if (results.length) {
      return { query: q, provider, results };
    }
  }

  return { query: q, provider: "none", results: [] };
}
