import "server-only";

import { fetch as undiciFetch, ProxyAgent } from "undici";

let proxyAgent: ProxyAgent | null = null;

/** VPN / Clash / Surge local proxy — Node does not use system VPN without this */
export function getProxyUrl(): string | undefined {
  const raw =
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.OPENAI_PROXY?.trim();
  return raw || undefined;
}

function getProxyAgent() {
  const url = getProxyUrl();
  if (!url) return null;
  if (!proxyAgent) proxyAgent = new ProxyAgent(url);
  return proxyAgent;
}

export function isProxyConfigured() {
  return Boolean(getProxyUrl());
}

/** fetch that routes through HTTPS_PROXY / OPENAI_PROXY (required for most VPN apps) */
export async function proxiedFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const agent = getProxyAgent();
  if (!agent) {
    return fetch(input, init);
  }
  return undiciFetch(input, {
    ...(init as Record<string, unknown>),
    dispatcher: agent,
  } as Parameters<typeof undiciFetch>[1]) as unknown as Response;
}
