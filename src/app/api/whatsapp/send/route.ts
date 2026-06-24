import { NextResponse } from "next/server";
import { z } from "zod";
import { sendWhatsAppMessageDetailed } from "@/lib/integrations/whatsapp";

const bodySchema = z.object({
  to: z.string().min(8).max(20),
  message: z.string().min(1).max(4096),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await sendWhatsAppMessageDetailed(
      parsed.data.to,
      parsed.data.message,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (error) {
    console.error("[WhatsApp send]", error);
    return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 });
  }
}
