import { NextResponse } from "next/server";
import { z } from "zod";
import { createTask, listTasks } from "@/lib/crm/store";

const schema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  status: z.enum(["pending", "in_progress", "done", "cancelled"]).default("pending"),
  due_at: z.string().nullable().optional(),
});

export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const task = await createTask({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      assigned_to: parsed.data.assigned_to ?? null,
      status: parsed.data.status,
      due_at: parsed.data.due_at ?? null,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("[Tasks POST]", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
