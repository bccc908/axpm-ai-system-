type Bucket = number[];

const buckets = new Map<string, Bucket>();

const HOUR = 60 * 60 * 1000;
const FIFTEEN_MIN = 15 * 60 * 1000;

const LIMITS = {
  signup: { ip: [5, HOUR], email: [3, HOUR] },
  login: { ip: [20, FIFTEEN_MIN], email: [10, FIFTEEN_MIN] },
  reset: { ip: [8, HOUR], email: [3, HOUR] },
  resend: { ip: [5, HOUR], email: [3, HOUR] },
} as const;

export type RateLimitAction = keyof typeof LIMITS;

export function clearRateLimits() {
  buckets.clear();
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim() ?? "";
    if (ip) return ip.slice(0, 80);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  return "unknown";
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  const prev = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (prev.length >= limit) {
    buckets.set(key, prev);
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - prev[0]!)) / 1000));
    return { ok: false, retryAfterSec };
  }
  prev.push(now);
  buckets.set(key, prev);
  return { ok: true };
}

/** Per-IP and, when an email is present, per-email. In-memory, per process. */
export function checkRateLimit(
  request: Request,
  action: RateLimitAction,
  email?: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const rule = LIMITS[action];
  const ipResult = rateLimit(`${action}:ip:${clientIp(request)}`, rule.ip[0], rule.ip[1]);
  if (!ipResult.ok) return ipResult;
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return { ok: true };
  return rateLimit(`${action}:email:${normalized}`, rule.email[0], rule.email[1]);
}
