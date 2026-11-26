import "server-only";

import { bridgeRequestAuthorized, localApiKey } from "@/lib/auth/secrets";

export function assertLocalApiAuth(request: Request) {
  if (!localApiKey()) {
    throw new LocalApiAuthError("LOCAL_API_KEY is not set");
  }
  if (!bridgeRequestAuthorized(request)) {
    throw new LocalApiAuthError("Unauthorized");
  }
}

export class LocalApiAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "LocalApiAuthError";
  }
}
