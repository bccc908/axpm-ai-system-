import { NextResponse } from "next/server";
import { z } from "zod";
import { readEmailToken } from "@/lib/auth/email-token";
import { authSecretUnavailableResponse } from "@/lib/auth/route-guard";
import { rateLimitResponse } from "@/lib/auth/rate-limit-response";
import { confirmPasswordReset } from "@/lib/auth/store";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const missingSecret = authSecretUnavailableResponse();
  if (missingSecret) return missingSecret;

  const limited = rateLimitResponse(request, "reset");
  if (limited) return limited;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }

  const claims = await readEmailToken(parsed.data.token);
  if (!claims || claims.purpose !== "reset-password") {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }

  const ok = await confirmPasswordReset(claims.sub, claims.nonce, parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
