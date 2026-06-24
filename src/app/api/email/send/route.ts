import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/integrations/email";

const bodySchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  cc: z.array(z.string().email()).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { to, subject, body, cc } = parsed.data;
    const recipients = Array.isArray(to) ? to : [to];
    const html = body.replace(/\n/g, "<br/>");

    const result = await sendEmail(
      { subject, text: body, html },
      { type: "outbound", to: recipients, cc },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (error) {
    console.error("[Email send]", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
