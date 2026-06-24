import { NextResponse } from "next/server";
import { getWhatsAppConfig, sendWhatsAppMessageDetailed } from "@/lib/integrations/whatsapp";

export async function POST(request: Request) {
  const wa = getWhatsAppConfig();

  if (!wa.configured) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to .env.local, then restart: npm run system",
      },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { to?: string };
  const to =
    body.to?.trim() ||
    wa.notifyPhone ||
    "";

  if (!to) {
    return NextResponse.json(
      {
        ok: false,
        error: "Set your WhatsApp number below (or WHATSAPP_NOTIFY_PHONE in .env.local)",
      },
      { status: 400 },
    );
  }

  const message = "信号旗 test — WhatsApp is linked successfully.";
  const result = await sendWhatsAppMessageDetailed(to, message);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    to,
    verifyTokenSet: wa.verifyTokenSet,
  });
}
