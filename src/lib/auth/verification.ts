/** Accounts created before email verification have no field and stay able to sign in. */
export function isEmailVerified(user: { email_verified_at?: string | null }): boolean {
  if (user.email_verified_at === undefined) return true;
  return Boolean(user.email_verified_at);
}
