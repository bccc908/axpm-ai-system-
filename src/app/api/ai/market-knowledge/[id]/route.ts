import { NextResponse } from "next/server";
import { deleteMarketKnowledgeFile } from "@/lib/ai/market-knowledge";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ok = await deleteMarketKnowledgeFile(id);
    if (!ok) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Market Knowledge Delete]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
