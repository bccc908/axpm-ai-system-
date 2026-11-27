import { countryFromHeaders, isMainlandChina } from "@/lib/i18n/locale-detect";
import { completeGoogleSignIn } from "@/lib/auth/google-account";
import {
  exchangeGoogleAuthCode,
  googleCredentialsConfigured,
  verifyGoogleIdToken,
} from "@/lib/auth/google-token";
import type { AuthUserPublic } from "@/lib/auth/types";

const REGION_ERROR = "Google sign-in is not available in this region";
const UNAVAILABLE_ERROR = "Google sign-in is unavailable";
const VERIFY_ERROR = "Could not verify Google sign-in";

export type GoogleHandlerResult = {
  status: number;
  body: { ok?: boolean; error?: string; created?: boolean; user?: AuthUserPublic };
  user?: AuthUserPublic;
};

export async function handleGoogleSignIn(
  request: Request,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleHandlerResult> {
  const country = countryFromHeaders(request.headers);
  if (isMainlandChina(country)) {
    return { status: 403, body: { error: REGION_ERROR } };
  }
  if (!googleCredentialsConfigured()) {
    return { status: 503, body: { error: UNAVAILABLE_ERROR } };
  }

  const payload = (await request.json().catch(() => null)) as { code?: unknown; credential?: unknown } | null;
  const code = typeof payload?.code === "string" ? payload.code.trim() : "";
  const credential = typeof payload?.credential === "string" ? payload.credential.trim() : "";
  if (!code && !credential) {
    return { status: 400, body: { error: VERIFY_ERROR } };
  }

  const profile = credential
    ? await verifyGoogleIdToken(credential, fetchImpl)
    : await exchangeGoogleAuthCode(code, fetchImpl);
  if (!profile) {
    return { status: 401, body: { error: VERIFY_ERROR } };
  }

  const result = await completeGoogleSignIn(profile, country);
  if (!result.ok) {
    return { status: result.status, body: { error: result.error } };
  }
  return {
    status: 200,
    user: result.user,
    body: { ok: true, created: result.created, user: result.user },
  };
}
