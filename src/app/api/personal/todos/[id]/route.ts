import { NextResponse } from "next/server";
import { z } from "zod";
import { jobPrioritySchema } from "@/lib/personal/constants";
import { deleteTodo, updateTodo } from "@/lib/personal/store";

const schema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  priority: jobPrioritySchema.optional(),
  due_at: z.string().nullable().optional(),
  done: z.boolean().optional(),
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

    const todo = await updateTodo(id, parsed.data);
    if (!todo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ todo });
  } catch (error) {
    console.error("[Personal Todos PATCH]", error);
    return NextResponse.json({ error: "Failed to update todo" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteTodo(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
