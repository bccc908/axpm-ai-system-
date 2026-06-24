import { NextResponse } from "next/server";
import { getPublicFortuneShareByToken } from "@/lib/fortune/public-share";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "zh";
  const share = await getPublicFortuneShareByToken(token, locale);
  if (!share) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  return NextResponse.json({ share });
}
