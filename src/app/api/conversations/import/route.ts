import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureClientFromContact } from "@/lib/crm/auto-client";
import { importWeChatPaste } from "@/lib/conversations/store";

const schema = z.object({
  client_id: z.string().uuid().optional(),
  client_name: z.string().min(1),
  wechat_id: z.string().nullable().optional(),
  paste: z.string().min(1),
  my_name: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    let clientId = parsed.data.client_id;
    let clientName = parsed.data.client_name;

    if (!clientId) {
      const ensured = await ensureClientFromContact({
        name: clientName,
        channel: "wechat",
        channelId: parsed.data.wechat_id,
        wechat: parsed.data.wechat_id,
        source: "conversation",
      });
      if (ensured.client?.id) {
        clientId = ensured.client.id;
        clientName = ensured.client.name;
      }
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "Select a client or enable auto-create in Settings" },
        { status: 400 },
      );
    }

    const result = await importWeChatPaste({
      client_id: clientId,
      client_name: clientName,
      wechat_id: parsed.data.wechat_id,
      paste: parsed.data.paste,
      my_name: parsed.data.my_name,
    });

    return NextResponse.json({
      ...result,
      client_id: clientId,
      client_created: !parsed.data.client_id,
    });
  } catch (error) {
    console.error("[Conversations Import]", error);
    return NextResponse.json({ error: "Failed to import conversation" }, { status: 400 });
  }
}
