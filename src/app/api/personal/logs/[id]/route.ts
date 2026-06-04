import { NextResponse } from "next/server";
import { deleteWorkLog } from "@/lib/personal/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteWorkLog(id);
    if (!deleted) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Personal Logs DELETE]", error);
    return NextResponse.json({ error: "Failed to delete log" }, { status: 500 });
  }
}
