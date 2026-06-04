import { NextResponse } from "next/server";
import { deleteTodoPhoto, getTodoPhotoFile } from "@/lib/personal/todo-photos";
import { readPersonalData } from "@/lib/personal/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const { id, photoId } = await params;
    const data = await readPersonalData();
    const todo = data.todos.find((t) => t.id === id);
    const photo = todo?.photos?.find((p) => p.id === photoId);
    if (!photo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { buffer } = await getTodoPhotoFile(photo.filename);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params;
  const ok = await deleteTodoPhoto(id, photoId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
