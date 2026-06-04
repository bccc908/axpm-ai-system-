import { NextResponse } from "next/server";
import { z } from "zod";
import { jobPrioritySchema } from "@/lib/personal/constants";
import { deleteJob, updateJob } from "@/lib/personal/store";

const schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  priority: jobPrioritySchema.optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
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

    const job = await updateJob(id, parsed.data);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("[Personal Jobs PATCH]", error);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteJob(id);
    if (!deleted) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Personal Jobs DELETE]", error);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
