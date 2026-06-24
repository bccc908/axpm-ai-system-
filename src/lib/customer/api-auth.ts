import "server-only";

import {
  canGenerateReading,
  findCustomerByApiKey,
  getCustomerAccount,
  touchCustomerApiKey,
} from "@/lib/customer/store";
import { findUserById } from "@/lib/auth/store";

export class CustomerApiAuthError extends Error {
  constructor(message = "Unauthorized — send Authorization: Bearer YOUR_API_KEY") {
    super(message);
    this.name = "CustomerApiAuthError";
  }
}

export async function resolveCustomerFromApiKey(request: Request, options?: { checkQuota?: boolean }) {
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-api-key") ??
    "";

  if (!header.trim()) {
    throw new CustomerApiAuthError();
  }

  const match = await findCustomerByApiKey(header.trim());
  if (!match) {
    throw new CustomerApiAuthError("Invalid API key");
  }

  const user = await findUserById(match.userId);
  if (!user || user.role !== "customer") {
    throw new CustomerApiAuthError("Account not active");
  }

  const account = await getCustomerAccount(match.userId);
  if (!account) {
    throw new CustomerApiAuthError("Account not found");
  }

  if (options?.checkQuota) {
    const quota = await canGenerateReading(match.userId);
    if (!quota.ok) {
      throw new CustomerApiAuthError(quota.reason ?? "Quota exceeded");
    }
  }

  await touchCustomerApiKey(match.keyId);

  return { user, account, keyId: match.keyId };
}
