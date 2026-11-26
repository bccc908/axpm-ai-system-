import { getAuthSecret } from "@/lib/auth/secrets";

export type EmailTokenPurpose = "verify-email" | "reset-password";

export interface EmailTokenClaims {
  sub: string;
  purpose: EmailTokenPurpose;
  nonce: string;
  exp: number;
}

const VERIFY_TTL_SECONDS = 24 * 60 * 60;
const RESET_TTL_SECONDS = 60 * 60;

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function decodeBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
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

export function emailTokenTtl(purpose: EmailTokenPurpose): number {
  return purpose === "verify-email" ? VERIFY_TTL_SECONDS : RESET_TTL_SECONDS;
}

export async function createEmailToken(input: {
  sub: string;
  purpose: EmailTokenPurpose;
  nonce: string;
}): Promise<string> {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const claims: EmailTokenClaims = {
    sub: input.sub,
    purpose: input.purpose,
    nonce: input.nonce,
    exp: Math.floor(Date.now() / 1000) + emailTokenTtl(input.purpose),
  };
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const sig = await hmacSign(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function readEmailToken(token: string | null | undefined): Promise<EmailTokenClaims | null> {
  if (!token) return null;
  const secret = getAuthSecret();
  if (!secret) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const ok = await hmacVerify(encoded, sig, secret);
  if (!ok) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded))) as EmailTokenClaims;
    if (!claims.sub || !claims.purpose || !claims.nonce || !claims.exp) return null;
    if (claims.purpose !== "verify-email" && claims.purpose !== "reset-password") return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
