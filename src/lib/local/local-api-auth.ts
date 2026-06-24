import "server-only";

import { getLocalApiKey } from "@/lib/local/self-hosted-config";

export function assertLocalApiAuth(request: Request) {
  const expected = getLocalApiKey();
  if (!expected) return;

  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-api-key") ??
    "";

  if (header !== expected) {
    throw new LocalApiAuthError();
  }
}

export class LocalApiAuthError extends Error {
  constructor() {
    super("Unauthorized — set Authorization: Bearer YOUR_LOCAL_API_KEY");
    this.name = "LocalApiAuthError";
  }
}
