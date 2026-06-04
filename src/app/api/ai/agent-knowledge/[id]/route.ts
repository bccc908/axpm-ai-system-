import { NextResponse } from "next/server";
import { deleteAgentKnowledgeFile } from "@/lib/ai/agent-knowledge";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ok = await deleteAgentKnowledgeFile(id);
    if (!ok) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Agent Knowledge DELETE]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
