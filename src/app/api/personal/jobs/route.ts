import { NextResponse } from "next/server";
import { z } from "zod";
import { jobPrioritySchema } from "@/lib/personal/constants";
import { createJob, listJobs } from "@/lib/personal/store";

const schema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().default("general"),
  priority: jobPrioritySchema.default("medium"),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).default("todo"),
  due_at: z.string().nullable().optional(),
});

export async function GET() {
  const jobs = await listJobs();
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const job = await createJob({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: parsed.data.status,
      due_at: parsed.data.due_at ?? null,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error("[Personal Jobs POST]", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
