import { NextResponse } from "next/server";
import { z } from "zod";
import { createTask, listTasks } from "@/lib/crm/store";
import { createActivity } from "@/lib/crm/pro-store";

const schema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  deal_id: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "in_progress", "done", "cancelled"]).default("pending"),
  due_at: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? undefined;
  const dealId = url.searchParams.get("deal_id") ?? undefined;
  const tasks = await listTasks({
    client_id: clientId,
    deal_id: dealId,
  });
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
      client_id: parsed.data.client_id ?? null,
      deal_id: parsed.data.deal_id ?? null,
      status: parsed.data.status,
      due_at: parsed.data.due_at ?? null,
    });

    if (parsed.data.client_id) {
      await createActivity({
        client_id: parsed.data.client_id,
        deal_id: parsed.data.deal_id ?? null,
        type: "task",
        title: `Task: ${task.title}`,
        body: task.description,
        metadata: { task_id: task.id, status: task.status },
      });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("[Tasks POST]", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
