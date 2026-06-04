import { NextResponse } from "next/server";
import { handleWhatsAppWebhook } from "@/lib/integrations/whatsapp-inbound";

/** Meta WhatsApp Cloud API webhook — auto-record messages + create clients */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await handleWhatsAppWebhook(body);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("[WhatsApp Webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
