import { NextResponse } from "next/server";
import { z } from "zod";
import { createMessage } from "@/lib/conversations/store";

const schema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  client_name: z.string().nullable().optional(),
  wechat_id: z.string().nullable().optional(),
  channel: z.enum(["whatsapp", "wechat", "telegram", "email", "phone", "web"]).optional(),
  direction: z.enum(["inbound", "outbound"]),
  sender_label: z.string().min(1),
  content: z.string().min(1),
  sent_at: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const message = await createMessage(parsed.data);
    return NextResponse.json({ message });
  } catch (error) {
    console.error("[Conversations POST]", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
