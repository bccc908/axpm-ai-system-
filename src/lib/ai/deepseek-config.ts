import "server-only";

export function getDeepSeekApiKey(): string | null {
  return process.env.DEEPSEEK_API_KEY?.trim() || null;
}

export function getDeepSeekBaseURL(): string {
  return process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
}

export function getDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
}

export function getDeepSeekReasonerModel(): string {
  return process.env.DEEPSEEK_REASONER_MODEL?.trim() || "deepseek-reasoner";
}

export function isDeepSeekConfigured(): boolean {
  return Boolean(getDeepSeekApiKey());
}
