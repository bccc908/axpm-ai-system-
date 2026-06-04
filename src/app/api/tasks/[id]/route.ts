import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteTask, updateTask } from "@/lib/crm/store";

const schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  status: z.enum(["pending", "in_progress", "done", "cancelled"]).optional(),
  due_at: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const task = await updateTask(id, parsed.data);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error) {
    console.error("[Tasks PATCH]", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Tasks DELETE]", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
