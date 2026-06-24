import "server-only";

export type WebSearchProvider = "tavily" | "serper";

export function getTavilyApiKey(): string | null {
  return process.env.TAVILY_API_KEY?.trim() || null;
}

export function getSerperApiKey(): string | null {
  return process.env.SERPER_API_KEY?.trim() || null;
}

export function getWebSearchProvider(): WebSearchProvider | "auto" {
  const raw = process.env.WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  if (raw === "tavily" || raw === "serper") return raw;
  return "auto";
}

export function isWebSearchConfigured(): boolean {
  return Boolean(getTavilyApiKey() || getSerperApiKey());
}

export function getActiveWebSearchProvider(): WebSearchProvider | null {
  const pref = getWebSearchProvider();
  if (pref === "serper" && getSerperApiKey()) return "serper";
  if (pref === "tavily" && getTavilyApiKey()) return "tavily";
  if (getSerperApiKey()) return "serper";
  if (getTavilyApiKey()) return "tavily";
  return null;
}

export function isWebSearchAutoEnabled(): boolean {
  const raw = process.env.WEB_SEARCH_AUTO?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  return true;
}

export function getWebSearchMaxResults(): number {
  const n = Number(process.env.WEB_SEARCH_MAX_RESULTS ?? "5");
  if (!Number.isFinite(n)) return 5;
  return Math.min(8, Math.max(3, Math.round(n)));
}
