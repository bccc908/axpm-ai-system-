import "server-only";

import { listUsers } from "@/lib/auth/store";
import { listCustomerAccounts } from "@/lib/customer/store";
import { buildProductSignupList, type ProductSignupList } from "@/lib/customers/product-signups";

/** Reads product sign-up users and their accounts. Does not create accounts. */
export async function loadProductSignups(now: Date = new Date()): Promise<ProductSignupList> {
  const [users, accounts] = await Promise.all([listUsers(), listCustomerAccounts()]);
  return buildProductSignupList(users, accounts, now);
}
