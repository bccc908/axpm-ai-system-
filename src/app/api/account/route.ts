import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import {
  countReferrals,
  getOrCreateCustomerAccount,
  toPublicAccount,
} from "@/lib/customer/store";
import { PLAN_CONFIG } from "@/lib/customer/plans";
import { buildCustomerSignupUrl } from "@/lib/referral";

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateCustomerAccount(ctx.user.id);
  const referralCount = await countReferrals(ctx.user.id);

  return NextResponse.json({
    account: toPublicAccount(account, referralCount),
    plans: PLAN_CONFIG,
    role: ctx.user.role,
    referralLinks: {
      zh: buildCustomerSignupUrl(ctx.user.id, "zh"),
      en: buildCustomerSignupUrl(ctx.user.id, "en"),
      auto: buildCustomerSignupUrl(ctx.user.id),
    },
  });
}
