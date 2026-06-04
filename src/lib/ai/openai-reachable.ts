import "server-only";
import { getLlmApiKey, getLlmBaseURL, getLlmProvider } from "@/lib/ai/llm-config";
import { isProxyConfigured, proxiedFetch } from "@/lib/ai/proxy-fetch";

const CACHE_MS = 60_000;
const PROBE_TIMEOUT_MS = 6_000;

let cache: { reachable: boolean; checkedAt: number } | null = null;

/** Instant read of last probe (null if never checked or cache expired) */
export function getCachedOpenAIReachable(): boolean | null {
  if (!getLlmApiKey()) return false;
  if (!cache) return null;
  if (Date.now() - cache.checkedAt > CACHE_MS) return null;
  return cache.reachable;
}

/** Quick probe so we skip a 15–20s OpenAI timeout when the network blocks api.openai.com */
export async function isOpenAIReachable(): Promise<boolean> {
  const apiKey = getLlmApiKey();
  if (!apiKey) return false;

  const now = Date.now();
  if (cache && now - cache.checkedAt < CACHE_MS) {
    return cache.reachable;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const base = getLlmBaseURL().replace(/\/$/, "");
    const fetchFn =
      getLlmProvider() === "deepseek" ? fetch : proxiedFetch;
    const res = await fetchFn(`${base}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    const reachable = res.ok || res.status === 401;
    cache = { reachable, checkedAt: now };
    return reachable;
  } catch {
    cache = { reachable: false, checkedAt: now };
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function clearOpenAIReachabilityCache() {
  cache = null;
}

export { isProxyConfigured };
