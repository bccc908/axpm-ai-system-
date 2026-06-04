import "server-only";
import {
  getOpenClawGatewayToken,
  getOpenClawGatewayURL,
  isOpenClawConfigured,
} from "@/lib/ai/openclaw-config";

let cached: { value: boolean; at: number } | null = null;
const CACHE_MS = 60_000;

export function getCachedOpenClawReachable() {
  if (!cached) return null;
  if (Date.now() - cached.at > CACHE_MS) return null;
  return cached.value;
}

export function clearOpenClawReachabilityCache() {
  cached = null;
}

export async function isOpenClawReachable() {
  if (!isOpenClawConfigured()) {
    cached = { value: false, at: Date.now() };
    return false;
  }

  const hit = getCachedOpenClawReachable();
  if (hit !== null) return hit;

  const base = getOpenClawGatewayURL().replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);

  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${getOpenClawGatewayToken()}` },
      signal: controller.signal,
    });
    const ok = res.ok;
    cached = { value: ok, at: Date.now() };
    return ok;
  } catch {
    cached = { value: false, at: Date.now() };
    return false;
  } finally {
    clearTimeout(timer);
  }
}
