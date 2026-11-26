import { NextResponse } from "next/server";
import { z } from "zod";
import { authSecretUnavailableResponse } from "@/lib/auth/route-guard";
import { rateLimitResponse } from "@/lib/auth/rate-limit-response";
import { sendVerificationLink } from "@/lib/auth/send-auth-link";
import { findUserByEmail } from "@/lib/auth/store";
import { isEmailVerified } from "@/lib/auth/verification";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const missingSecret = authSecretUnavailableResponse();
  if (missingSecret) return missingSecret;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const limited = rateLimitResponse(request, "resend", parsed.data.email);
  if (limited) return limited;

  const user = await findUserByEmail(parsed.data.email);
  if (user && !isEmailVerified(user)) {
    try {
      await sendVerificationLink(user.id, true);
    } catch (error) {
      console.error("[resend verification]", error instanceof Error ? error.message : "send failed");
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If an unverified account exists for that email, a new link is on the way.",
  });
}
