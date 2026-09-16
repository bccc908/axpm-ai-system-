import "server-only";

export const HL_INFO_URL = "https://api.hyperliquid.xyz/info";
export const HL_COIN = "BTC";

export async function hlInfo<T>(body: unknown, timeoutMs = 8_000): Promise<T> {
  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid ${res.status}`);
  }
  return (await res.json()) as T;
}

export function isHlAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function normalizeHlAddress(value: string): string {
  return value.trim();
}
