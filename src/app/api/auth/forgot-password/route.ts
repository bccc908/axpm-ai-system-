import { NextResponse } from "next/server";
import { z } from "zod";
import { authSecretUnavailableResponse } from "@/lib/auth/route-guard";
import { rateLimitResponse } from "@/lib/auth/rate-limit-response";
import { sendPasswordResetLink } from "@/lib/auth/send-auth-link";

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

  const limited = rateLimitResponse(request, "reset", parsed.data.email);
  if (limited) return limited;

  try {
    await sendPasswordResetLink(parsed.data.email);
  } catch (error) {
    console.error("[password reset]", error instanceof Error ? error.message : "send failed");
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on the way.",
  });
}
