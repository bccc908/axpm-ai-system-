/**
 * Phase-1 mainland signup block. It stays off until SIGNUP_BLOCK_MAINLAND=1,
 * so today's signup behaviour is unchanged. Hong Kong, Macau, Taiwan, and an
 * unknown country are not mainland. Callers must return before creating a
 * customer when this is true, and must not send an owner alert.
 */
export function isMainlandSignupBlocked(input: {
  country: string | null | undefined;
  enabled: boolean;
}): boolean {
  if (!input.enabled) return false;
  return input.country?.trim().toUpperCase() === "CN";
}
