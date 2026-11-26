import { AuthSecretError } from "@/lib/auth/secret-error";

export { AuthSecretError } from "@/lib/auth/secret-error";

/** Session signing key. No default and no fallback to CRON_SECRET. */
export function getAuthSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret || null;
}

export function assertAuthSecretConfigured(): void {
  if (!getAuthSecret()) {
    throw new AuthSecretError("AUTH_SECRET is not set");
  }
}

export function cronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || null;
}

export function localApiKey(): string | null {
  const key = process.env.LOCAL_API_KEY?.trim();
  return key || null;
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

/** True only when CRON_SECRET is set and the request presents it. Unset means closed. */
export function cronRequestAuthorized(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  if (request.headers.get("authorization")?.trim() === `Bearer ${secret}`) return true;
  try {
    return new URL(request.url).searchParams.get("secret") === secret;
  } catch {
    return false;
  }
}

/** True only when LOCAL_API_KEY is set and the request presents it. Unset means closed. */
export function bridgeRequestAuthorized(request: Request): boolean {
  const expected = localApiKey();
  if (!expected) return false;
  const presented = bearerToken(request) || request.headers.get("x-api-key")?.trim() || "";
  return presented === expected;
}
