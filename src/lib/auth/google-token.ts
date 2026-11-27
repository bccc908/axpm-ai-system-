export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

type TokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  iss?: string;
  exp?: string | number;
  error?: string;
};

export function googleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

export function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

export function googleCredentialsConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

function emailIsVerified(value: string | boolean | undefined): boolean {
  return value === true || value === "true";
}

export function profileFromTokenInfo(info: TokenInfo | null | undefined, clientId: string): GoogleProfile | null {
  if (!info || info.error) return null;
  if (!clientId || info.aud !== clientId) return null;
  if (!info.iss || !GOOGLE_ISSUERS.has(info.iss)) return null;
  if (!info.sub || !info.email?.includes("@")) return null;
  if (!emailIsVerified(info.email_verified)) return null;
  const exp = typeof info.exp === "string" ? Number(info.exp) : info.exp;
  if (!exp || !Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
  return {
    sub: info.sub,
    email: info.email.trim(),
    emailVerified: true,
    name: info.name?.trim() || null,
  };
}

export async function verifyGoogleIdToken(
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleProfile | null> {
  const clientId = googleClientId();
  if (!clientId || !idToken.trim()) return null;
  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("id_token", idToken.trim());
  try {
    const res = await fetchImpl(url, { method: "GET" });
    if (!res.ok) return null;
    const info = (await res.json()) as TokenInfo;
    return profileFromTokenInfo(info, clientId);
  } catch {
    return null;
  }
}

/** GIS popup code client. redirect_uri is the fixed postmessage value, not a secret. */
export async function exchangeGoogleAuthCode(
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleProfile | null> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret || !code.trim()) return null;
  try {
    const res = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code.trim(),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { id_token?: string };
    if (!payload.id_token) return null;
    return verifyGoogleIdToken(payload.id_token, fetchImpl);
  } catch {
    return null;
  }
}
