import "server-only";
import {
  getDeepSeekApiKey,
  getDeepSeekBaseURL,
  getDeepSeekModel,
  isDeepSeekConfigured,
} from "@/lib/ai/deepseek-config";

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

export async function deepSeekChat(params: {
  messages: DeepSeekMessage[];
  model?: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
}): Promise<
  | { ok: true; content: string; model: string; usage?: unknown }
  | { ok: false; error: string }
> {
  const apiKey = params.apiKey?.trim() || getDeepSeekApiKey();
  if (!apiKey) {
    return { ok: false, error: "DEEPSEEK_API_KEY not set in .env.local" };
  }

  const model = params.model ?? getDeepSeekModel();
  const base = (params.baseUrl ?? getDeepSeekBaseURL()).replace(/\/$/, "");
  const chatUrl = base.endsWith("/v1")
    ? `${base}/chat/completions`
    : `${base}/chat/completions`;
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
      const res = await fetch(chatUrl, {
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
        return { ok: false, error: "Invalid DEEPSEEK_API_KEY" };
      }
      if (res.status === 402) {
        return {
          ok: false,
          error: "Insufficient Balance — top up at platform.deepseek.com",
        };
      }
      if (res.status === 429) {
        return { ok: false, error: "DeepSeek rate limit — try again shortly" };
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
        error: `DeepSeek returned an empty response${hint}`,
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
      error instanceof Error ? error.message : "DeepSeek request failed";
    if (message.includes("abort")) {
      return { ok: false, error: "DeepSeek request timed out" };
    }
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
