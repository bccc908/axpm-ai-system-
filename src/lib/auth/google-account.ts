import { getOrCreateCustomerAccount } from "@/lib/customer/store";
import { isMainlandChina } from "@/lib/i18n/locale-detect";
import {
  findUserRecordByEmail,
  needsSetup,
  registerGoogleCustomer,
  rememberGoogleSubject,
  toPublicUser,
} from "@/lib/auth/store";
import type { AuthUserPublic } from "@/lib/auth/types";
import type { GoogleProfile } from "@/lib/auth/google-token";

export type GoogleSignInResult =
  | { ok: true; created: boolean; user: AuthUserPublic }
  | { ok: false; status: number; error: string };

const REGION_ERROR = "Google sign-in is not available in this region";
const VERIFY_ERROR = "Could not verify Google sign-in";
const SETUP_ERROR = "Owner setup required first — use /login to create admin account";
const DISABLED_ERROR = "This account is disabled";

/**
 * Sign in to the password account that already uses this email.
 * A new email becomes a customer. Never a second user, never staff.
 */
export async function signInExistingOrCreateCustomer(profile: GoogleProfile): Promise<GoogleSignInResult> {
  if (!profile.emailVerified || !profile.sub || !profile.email.includes("@")) {
    return { ok: false, status: 400, error: VERIFY_ERROR };
  }
  if (await needsSetup()) {
    return { ok: false, status: 403, error: SETUP_ERROR };
  }

  const existing = await findUserRecordByEmail(profile.email);
  if (existing) {
    if (!existing.is_active) {
      return { ok: false, status: 403, error: DISABLED_ERROR };
    }
    const linked = await rememberGoogleSubject(existing.id, profile.sub);
    return {
      ok: true,
      created: false,
      user: toPublicUser(linked ?? existing),
    };
  }

  const email = profile.email.trim().toLowerCase();
  const name = (profile.name?.trim() || email.split("@")[0] || "Customer").slice(0, 80);
  const user = await registerGoogleCustomer({
    email,
    name,
    googleSub: profile.sub,
  });
  if (user.role !== "customer") {
    return { ok: false, status: 500, error: VERIFY_ERROR };
  }
  await getOrCreateCustomerAccount(user.id);
  return { ok: true, created: true, user };
}

export async function completeGoogleSignIn(
  profile: GoogleProfile,
  country: string | null,
): Promise<GoogleSignInResult> {
  if (isMainlandChina(country)) {
    return { ok: false, status: 403, error: REGION_ERROR };
  }
  return signInExistingOrCreateCustomer(profile);
}
