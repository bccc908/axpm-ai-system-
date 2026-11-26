import { sessionLoginSpace } from "@/lib/auth/login-space";
import { verifySessionToken } from "@/lib/auth/session";
import { CUSTOMER_SESSION_COOKIE, SESSION_COOKIE, type SessionPayload } from "@/lib/auth/types";

/**
 * Staff credentials live in the staff cookie. Customer credentials live in the
 * customer cookie. A token in the wrong cookie is ignored. Customer tokens that
 * were issued into the staff cookie before the split still count as customer
 * sessions so existing sign-ins keep working.
 */
export async function readLoginSessions(
  getCookie: (name: string) => string | undefined,
): Promise<{ staff: SessionPayload | null; customer: SessionPayload | null }> {
  const staffJar = await verifySessionToken(getCookie(SESSION_COOKIE));
  const customerJar = await verifySessionToken(getCookie(CUSTOMER_SESSION_COOKIE));

  let staff: SessionPayload | null = null;
  let customer: SessionPayload | null = null;

  const staffSpace = staffJar ? sessionLoginSpace(staffJar) : null;
  if (staffJar && staffSpace === "staff") staff = staffJar;
  if (staffJar && staffSpace === "customer") customer = staffJar;

  const customerSpace = customerJar ? sessionLoginSpace(customerJar) : null;
  if (customerJar && customerSpace === "customer") customer = customerJar;

  return { staff, customer };
}
