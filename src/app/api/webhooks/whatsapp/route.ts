import { NextResponse } from "next/server";
import { handleWhatsAppWebhook } from "@/lib/integrations/whatsapp-inbound";
import { verifyMetaSignature } from "@/lib/integrations/webhook-signature";

/** Meta WhatsApp Cloud API webhook — auto-record messages + create clients */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  // Read the raw body first: the signature covers the exact bytes Meta sent.
  const rawBody = await request.text();
  const signed = verifyMetaSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    process.env.WHATSAPP_APP_SECRET,
  );
  if (!signed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody) as unknown;
    const result = await handleWhatsAppWebhook(body);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("[WhatsApp Webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
