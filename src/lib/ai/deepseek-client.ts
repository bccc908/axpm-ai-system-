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

function chatCompletionsUrl() {
  const base = getDeepSeekBaseURL().replace(/\/$/, "");
  return base.endsWith("/v1")
    ? `${base}/chat/completions`
    : `${base}/chat/completions`;
}

export async function deepSeekChat(params: {
  messages: DeepSeekMessage[];
  model?: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<
  | { ok: true; content: string; model: string; usage?: unknown }
  | { ok: false; error: string }
> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    return { ok: false, error: "DEEPSEEK_API_KEY not set in .env.local" };
  }

  const model = params.model ?? getDeepSeekModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(chatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.45,
        max_tokens: params.maxTokens ?? 900,
        ...(params.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
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

    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { ok: false, error: "DeepSeek returned an empty response" };
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
