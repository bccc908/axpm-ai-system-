import "server-only";

export type LlmProvider = "deepseek" | "openai";

/** Which LLM API to use. `auto` prefers DeepSeek when DEEPSEEK_API_KEY is set. */
export function getLlmProvider(): LlmProvider {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "deepseek" || explicit === "openai") return explicit;
  if (process.env.DEEPSEEK_API_KEY?.trim()) return "deepseek";
  return "openai";
}

export function getLlmApiKey(): string | null {
  if (getLlmProvider() === "deepseek") {
    return process.env.DEEPSEEK_API_KEY?.trim() || null;
  }
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export function getLlmBaseURL(): string {
  if (getLlmProvider() === "deepseek") {
    const custom = process.env.DEEPSEEK_BASE_URL?.trim();
    return custom || "https://api.deepseek.com";
  }
  return process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
}

export function getChatModel(): string {
  if (getLlmProvider() === "deepseek") {
    return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  }
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function isLlmConfigured(): boolean {
  return Boolean(getLlmApiKey());
}

export function getLlmDisplayName(): string {
  return getLlmProvider() === "deepseek" ? "DeepSeek" : "OpenAI";
}
