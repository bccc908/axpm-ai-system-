import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { publishToFacebook } from "@/lib/integrations/meta-social";

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx || ctx.user.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Owner only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message =
    body.message?.trim() ||
    "信号旗测试帖 — Facebook 已成功连接 ✅\nSignal Flag test post — Facebook connected.";

  const result = await publishToFacebook({ message });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    postId: result.id,
    message: "Posted to Facebook Page feed",
  });
}
