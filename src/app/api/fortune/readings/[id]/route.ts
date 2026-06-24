import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { deleteScopedFortuneReading, fortuneScopeForRole } from "@/lib/fortune/context";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getServerSession();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const scope = fortuneScopeForRole(ctx.user.id, ctx.user.role);
    const ok = await deleteScopedFortuneReading(scope, id);
    if (!ok) {
      return NextResponse.json({ error: "Reading not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Fortune reading DELETE]", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
