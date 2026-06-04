import { NextResponse } from "next/server";
import { z } from "zod";
import { createReminder, listReminders } from "@/lib/crm/store";

const schema = z.object({
  client_id: z.string().nullable().optional(),
  team_member_id: z.string().nullable().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  channel: z.enum(["telegram", "whatsapp"]).default("telegram"),
  scheduled_at: z.string(),
});

export async function GET() {
  const reminders = await listReminders();
  return NextResponse.json({ reminders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const reminder = await createReminder({
      client_id: parsed.data.client_id ?? null,
      team_member_id: parsed.data.team_member_id ?? null,
      title: parsed.data.title,
      message: parsed.data.message,
      channel: parsed.data.channel,
      scheduled_at: parsed.data.scheduled_at,
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    console.error("[CRM Reminders POST]", error);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
