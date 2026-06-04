import { NextResponse } from "next/server";
import { z } from "zod";
import { createFollowUp, listFollowUps } from "@/lib/crm/store";

const schema = z.object({
  client_id: z.string().min(1),
  channel: z.enum(["whatsapp", "wechat", "telegram", "email", "phone"]).default("phone"),
  summary: z.string().min(1),
  notes: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export async function GET() {
  const followUps = await listFollowUps();
  return NextResponse.json({ followUps });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const followUp = await createFollowUp({
      client_id: parsed.data.client_id,
      team_member_id: null,
      channel: parsed.data.channel,
      summary: parsed.data.summary,
      notes: parsed.data.notes ?? parsed.data.summary,
      scheduled_at: null,
      completed_at: parsed.data.completed_at ?? new Date().toISOString(),
    });

    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error) {
    console.error("[CRM Follow-ups POST]", error);
    return NextResponse.json({ error: "Failed to log follow-up" }, { status: 500 });
  }
}
