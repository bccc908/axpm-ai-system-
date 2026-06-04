import { NextResponse } from "next/server";
import { z } from "zod";
import { sendWeChatWorkToClient } from "@/lib/integrations/wechat-work";

const schema = z.object({
  client_id: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await sendWeChatWorkToClient(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ sent: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      sent: true,
      msgid: result.msgid,
      message: result.message,
    });
  } catch (error) {
    console.error("[WeChat Work Send]", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
