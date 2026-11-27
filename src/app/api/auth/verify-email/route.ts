import { NextResponse } from "next/server";
import { z } from "zod";
import { readEmailToken } from "@/lib/auth/email-token";
import { startOwnerCustomerAlert } from "@/lib/auth/owner-alert";
import { authSecretUnavailableResponse } from "@/lib/auth/route-guard";
import { confirmVerification, findUserById } from "@/lib/auth/store";
import { isEmailVerified } from "@/lib/auth/verification";
import { getCustomerAccount } from "@/lib/customer/store";

const bodySchema = z.object({
  token: z.string().min(10),
});

async function confirm(token: string | null) {
  const missingSecret = authSecretUnavailableResponse();
  if (missingSecret) return missingSecret;

  const claims = await readEmailToken(token);
  if (!claims || claims.purpose !== "verify-email") {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }
  const before = await findUserById(claims.sub);
  const previouslyUnverifiedCustomer = Boolean(
    before && before.role === "customer" && !isEmailVerified(before),
  );
  const ok = await confirmVerification(claims.sub, claims.nonce);
  if (!ok) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }
  if (previouslyUnverifiedCustomer && before) {
    const account = await getCustomerAccount(before.id);
    const verifiedAt = (await findUserById(before.id))?.email_verified_at;
    startOwnerCustomerAlert({
      event: "email_verified",
      userId: before.id,
      name: before.name,
      email: before.email,
      occurredAt: verifiedAt || new Date().toISOString(),
      plan: account?.plan ?? "free",
      blocked: false,
    });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  return confirm(token);
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }
  return confirm(parsed.data.token);
}
