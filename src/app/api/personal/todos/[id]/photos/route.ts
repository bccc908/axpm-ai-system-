import { NextResponse } from "next/server";
import { addTodoPhoto } from "@/lib/personal/todo-photos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const photo = await addTodoPhoto(id, file);
    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    console.error("[Todo photo upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
