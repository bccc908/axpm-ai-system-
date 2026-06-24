import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/integrations/email";
import { createActivity } from "@/lib/crm/pro-store";
import { readCrmData } from "@/lib/crm/store";

const bodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await readCrmData();
    const client = data.clients.find((c) => c.id === id);
    if (!client) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { to, subject, body } = parsed.data;
    const html = body.replace(/\n/g, "<br/>");
    const result = await sendEmail(
      { subject, text: body, html },
      { type: "crm_outbound", to: [to] },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const openDeal = data.deals.find((d) => d.client_id === id && d.status === "open");
    await createActivity({
      client_id: id,
      deal_id: openDeal?.id ?? null,
      type: "email",
      title: `Email: ${subject}`,
      body,
      channel: "email",
      actor_name: "CRM",
      metadata: { to, message_id: result.messageId },
    });

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (error) {
    console.error("[CRM contact email]", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
