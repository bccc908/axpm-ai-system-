import { NextResponse } from "next/server";
import { z } from "zod";
import { createActivity, listActivities } from "@/lib/crm/pro-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  client_id: z.string().uuid(),
  deal_id: z.string().uuid().nullable().optional(),
  type: z.enum(["note", "call", "email", "meeting", "task"]),
  title: z.string().min(1).max(200),
  body: z.string().max(4000).nullable().optional(),
  channel: z.enum(["whatsapp", "wechat", "telegram", "email", "phone", "web"]).nullable().optional(),
  actor_name: z.string().max(80).nullable().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? undefined;
  const limit = url.searchParams.get("limit");
  const activities = await listActivities({
    client_id: clientId ?? undefined,
    limit: limit ? Number(limit) : 50,
  });
  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const activity = await createActivity(parsed.data);
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("[CRM Activities POST]", error);
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
  }
}
