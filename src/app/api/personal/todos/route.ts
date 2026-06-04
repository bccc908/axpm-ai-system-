import { NextResponse } from "next/server";
import { z } from "zod";
import { jobPrioritySchema } from "@/lib/personal/constants";
import { notifyNewTodo } from "@/lib/integrations/todo-notify";
import { createTodo, listTodos } from "@/lib/personal/store";

const schema = z.object({
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  priority: jobPrioritySchema.default("medium"),
  due_at: z.string().nullable().optional(),
  done: z.boolean().default(false),
});

export async function GET() {
  const todos = await listTodos();
  return NextResponse.json({ todos });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const todo = await createTodo({
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      priority: parsed.data.priority,
      due_at: parsed.data.due_at ?? null,
      done: parsed.data.done,
    });

    let notify;
    try {
      notify = await notifyNewTodo(todo);
    } catch (error) {
      console.error("[Personal Todos notify]", error);
      notify = {
        telegram: { sent: false, error: "Notification failed — try again from Settings" },
        whatsapp: { sent: false },
      };
    }

    return NextResponse.json({ todo, notify }, { status: 201 });
  } catch (error) {
    console.error("[Personal Todos POST]", error);
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
  }
}
