import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (!token || !phoneNumberId) {
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
    process.env.WHATSAPP_NOTIFY_PHONE?.trim() ||
    "";

  if (!to) {
    return NextResponse.json(
      {
        ok: false,
        error: "Set your phone in Settings → WhatsApp (or WHATSAPP_NOTIFY_PHONE in .env.local)",
      },
      { status: 400 },
    );
  }

  const message = "AXPM test — WhatsApp is linked successfully.";
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: { body: message },
      }),
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          (data as { error?: { message?: string } }).error?.message ??
          "WhatsApp send failed — check token and phone number ID",
        details: data,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    to,
    verifyTokenSet: Boolean(verifyToken),
  });
}
