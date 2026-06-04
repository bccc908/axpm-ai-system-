import { NextResponse } from "next/server";
import { z } from "zod";
import { createWorkLog, listWorkLogs } from "@/lib/personal/store";

const schema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
  category: z.string().default("general"),
  duration_minutes: z.number().nullable().optional(),
  logged_at: z.string().optional(),
});

export async function GET() {
  const logs = await listWorkLogs();
  return NextResponse.json({ logs });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const log = await createWorkLog({
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      duration_minutes: parsed.data.duration_minutes ?? null,
      logged_at: parsed.data.logged_at ?? new Date().toISOString(),
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error("[Personal Logs POST]", error);
    return NextResponse.json({ error: "Failed to create log" }, { status: 500 });
  }
}
