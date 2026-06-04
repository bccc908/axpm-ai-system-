import { NextResponse } from "next/server";
import { deleteMessage } from "@/lib/conversations/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteMessage(id);
    if (!deleted) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Conversations DELETE]", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
