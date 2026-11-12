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

/**
 * Drop any explicit Content-Length. The OpenAI SDK always sets one, and once
 * the undici package is loaded (this file imports it) Node's built-in fetch
 * rejects it with "invalid content-length header". fetch computes the length
 * itself, so removing it is safe.
 */
export function withoutContentLength(init?: RequestInit): RequestInit | undefined {
  if (!init?.headers) return init;
  const headers = new Headers(init.headers as HeadersInit);
  if (!headers.has("content-length")) return init;
  headers.delete("content-length");
  return { ...init, headers };
}

/** fetch that routes through HTTPS_PROXY / OPENAI_PROXY (required for most VPN apps) */
export async function proxiedFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const safeInit = withoutContentLength(init);
  const agent = getProxyAgent();
  if (!agent) {
    return fetch(input, safeInit);
  }
  return undiciFetch(input, {
    ...(safeInit as Record<string, unknown>),
    dispatcher: agent,
  } as Parameters<typeof undiciFetch>[1]) as unknown as Response;
}
