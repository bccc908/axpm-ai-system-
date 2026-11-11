import OpenAI from "openai";
import {
  getLlmApiKey,
  getLlmBaseURL,
  getLlmDisplayName,
  getLlmProvider,
} from "@/lib/ai/llm-config";
import { isProxyConfigured, proxiedFetch } from "@/lib/ai/proxy-fetch";

export {
  getLlmProvider,
  getChatModel,
  isLlmConfigured,
  getLlmDisplayName,
  getLlmBaseURL as getOpenAIBaseURL,
} from "@/lib/ai/llm-config";
export { getProxyUrl, isProxyConfigured } from "@/lib/ai/proxy-fetch";

export function getOpenAI() {
  const apiKey = getLlmApiKey();
  if (!apiKey) return null;
  const provider = getLlmProvider();
  return new OpenAI({
    apiKey,
    baseURL: getLlmBaseURL(),
    timeout: provider === "deepseek" ? 60_000 : 18_000,
    maxRetries: 0,
    // DeepSeek works direct in China — skip VPN proxy that breaks api.deepseek.com
    fetch: (provider === "deepseek" ? fetch : proxiedFetch) as typeof fetch,
  });
}

export function openAiErrorMessage(error: unknown): string {
  const name = getLlmDisplayName();
  if (error instanceof Error) {
    if (error.message.includes("401") || error.message.includes("Incorrect API key")) {
      return `Invalid ${name} API key — check your key in .env.local`;
    }
    if (error.message.includes("429")) {
      return `${name} rate limit — wait a moment and try again`;
    }
    if (error.message.includes("timeout") || error.message.includes("timed out")) {
      return getLlmProvider() === "deepseek"
        ? `${name} request timed out — check network or DEEPSEEK_BASE_URL`
        : `${name} request timed out — set OPENAI_PROXY in .env.local if using VPN`;
    }
    if (error.message.includes("ECONNREFUSED") && !isProxyConfigured()) {
      return `Cannot connect to ${name} — check API key and base URL`;
    }
    return error.message;
  }
  return `${name} request failed`;
}

export function isInsufficientLlmBalance(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /(?:\b402\b|insufficient balance)/i.test(msg);
}
