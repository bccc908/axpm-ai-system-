import type { SessionPayload } from "@/lib/auth/types";

export { SESSION_COOKIE } from "@/lib/auth/types";

const SESSION_DAYS = 14;

function getSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "signalqi-dev-change-me-in-production"
  );
}

function encodeBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64url"));
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return encodeBase64Url(new Uint8Array(sig));
}

async function hmacVerify(message: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  try {
    return crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature) as BufferSource,
      new TextEncoder().encode(message),
    );
  } catch {
    return false;
  }
}

export async function createSessionToken(payload: Omit<SessionPayload, "exp">): Promise<string> {
  const body: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
  };
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  const sig = await hmacSign(encoded, getSecret());
  return `${encoded}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const ok = await hmacVerify(encoded, sig, getSecret());
  if (!ok) return null;
  try {
    const json = new TextDecoder().decode(decodeBase64Url(encoded));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.sub || !payload.role || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isHttpsRequest(request: { headers: Headers; url: string }): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim().toLowerCase() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Origin the browser actually used, including when Caddy proxies to 127.0.0.1:3000. */
export function publicRequestOrigin(request: { headers: Headers; url: string }): string {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    .trim();
  const proto = (
    request.headers.get("x-forwarded-proto") ||
    (request.url.startsWith("https:") ? "https" : "http")
  )
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (host) return `${proto}://${host}`;
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://127.0.0.1:3000";
  }
}

export function sessionCookieOptions(
  maxAgeSeconds = SESSION_DAYS * 86400,
  request?: { headers: Headers; url: string },
) {
  return {
    httpOnly: true,
    // Only mark Secure on real HTTPS. A production HTTP IP login would otherwise
    // set a cookie the browser drops, and middleware redirects would bounce forever.
    secure: request ? isHttpsRequest(request) : false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
