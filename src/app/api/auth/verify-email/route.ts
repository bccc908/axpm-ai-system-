import { NextResponse } from "next/server";
import { z } from "zod";
import { readEmailToken } from "@/lib/auth/email-token";
import { authSecretUnavailableResponse } from "@/lib/auth/route-guard";
import { confirmVerification } from "@/lib/auth/store";

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
  const ok = await confirmVerification(claims.sub, claims.nonce);
  if (!ok) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
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
