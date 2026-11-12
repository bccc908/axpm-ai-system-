import "server-only";
import {
  getDeepSeekApiKey,
  getDeepSeekBaseURL,
  getDeepSeekModel,
  isDeepSeekConfigured,
} from "@/lib/ai/deepseek-config";
import {
  getChatModel,
  getLlmApiKey,
  getLlmBaseURL,
  getLlmDisplayName,
  getLlmProvider,
} from "@/lib/ai/llm-config";
import { proxiedFetch } from "@/lib/ai/proxy-fetch";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

let reachCache: { ok: boolean; at: number } | null = null;
const CACHE_MS = 60_000;

export function getCachedDeepSeekReachable(): boolean | null {
  if (!isDeepSeekConfigured()) return false;
  if (!reachCache) return null;
  if (Date.now() - reachCache.at > CACHE_MS) return null;
  return reachCache.ok;
}

export function clearDeepSeekReachabilityCache() {
  reachCache = null;
}

export async function isDeepSeekReachable(): Promise<boolean> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) return false;

  const cached = getCachedDeepSeekReachable();
  if (cached !== null) return cached;

  const base = getDeepSeekBaseURL().replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);

  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    const ok = res.ok || res.status === 401;
    reachCache = { ok, at: Date.now() };
    return ok;
  } catch {
    reachCache = { ok: false, at: Date.now() };
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type ChatParams = {
  messages: DeepSeekMessage[];
  model?: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
};

export type ChatResult =
  | { ok: true; content: string; model: string; usage?: unknown }
  | { ok: false; error: string };

/** DeepSeek-only chat (kept for callers that need DeepSeek specifically). */
export async function deepSeekChat(params: ChatParams): Promise<ChatResult> {
  return chatCompletion(params, {
    name: "DeepSeek",
    keyEnv: "DEEPSEEK_API_KEY",
    apiKey: params.apiKey?.trim() || getDeepSeekApiKey(),
    baseUrl: params.baseUrl ?? getDeepSeekBaseURL(),
    model: params.model ?? getDeepSeekModel(),
    fetchImpl: fetch,
    topUpHint: "top up at platform.deepseek.com",
  });
}

/**
 * Provider-neutral chat: follows AI_PROVIDER via llm-config
 * (OpenAI or DeepSeek), same return shape as deepSeekChat.
 */
export async function llmChat(params: ChatParams): Promise<ChatResult> {
  const provider = getLlmProvider();
  if (provider === "deepseek") return deepSeekChat(params);
  return chatCompletion(params, {
    name: getLlmDisplayName(),
    keyEnv: "OPENAI_API_KEY",
    apiKey: params.apiKey?.trim() || getLlmApiKey(),
    baseUrl: params.baseUrl ?? getLlmBaseURL(),
    model: params.model ?? getChatModel(),
    fetchImpl: proxiedFetch as typeof fetch,
    topUpHint: "check billing at platform.openai.com",
  });
}

async function chatCompletion(
  params: ChatParams,
  cfg: {
    name: string;
    keyEnv: string;
    apiKey: string | null;
    baseUrl: string;
    model: string;
    fetchImpl: typeof fetch;
    topUpHint: string;
  },
): Promise<ChatResult> {
  const apiKey = cfg.apiKey;
  if (!apiKey) {
    return { ok: false, error: `${cfg.keyEnv} not set in .env.local` };
  }

  const model = cfg.model;
  const base = cfg.baseUrl.replace(/\/$/, "");
  const chatUrl = `${base}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const body: Record<string, unknown> = {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.45,
      max_tokens: params.maxTokens ?? 900,
    };

    const attempt = async (jsonMode: boolean) => {
      const res = await cfg.fetchImpl(chatUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });
      return res;
    };

    const res = await attempt(Boolean(params.json));

    let data = (await res.json().catch(() => ({}))) as {
      choices?: {
        finish_reason?: string;
        message?: { content?: string | null; reasoning_content?: string | null };
      }[];
      usage?: unknown;
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 401) {
        return { ok: false, error: `Invalid ${cfg.keyEnv}` };
      }
      if (res.status === 402) {
        return {
          ok: false,
          error: `Insufficient Balance — ${cfg.topUpHint}`,
        };
      }
      if (res.status === 429) {
        const quota = /quota|billing/i.test(msg);
        return {
          ok: false,
          error: quota
            ? `Insufficient Balance — ${cfg.name}: ${msg}`
            : `${cfg.name} rate limit — try again shortly`,
        };
      }
      return { ok: false, error: msg };
    }

    const choice = data.choices?.[0];
    const message = choice?.message as
      | { content?: string | null; reasoning_content?: string | null }
      | undefined;
    let content =
      message?.content?.trim() ||
      message?.reasoning_content?.trim() ||
      "";

    if (!content && params.json) {
      const retry = await attempt(false);
      const retryData = (await retry.json().catch(() => ({}))) as typeof data;
      if (retry.ok) {
        const retryMsg = retryData.choices?.[0]?.message as
          | { content?: string | null; reasoning_content?: string | null }
          | undefined;
        content =
          retryMsg?.content?.trim() ||
          retryMsg?.reasoning_content?.trim() ||
          "";
        if (content) {
          data = retryData;
        }
      }
    }

    if (!content) {
      const finish = choice?.finish_reason ?? "unknown";
      const hint =
        finish === "length"
          ? "（上下文过长，已截断）"
          : finish === "content_filter"
            ? "（内容被过滤）"
            : "";
      return {
        ok: false,
        error: `${cfg.name} returned an empty response${hint}`,
      };
    }

    return {
      ok: true,
      content,
      model,
      usage: data.usage,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `${cfg.name} request failed`;
    if (message.includes("abort")) {
      return { ok: false, error: `${cfg.name} request timed out` };
    }
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
