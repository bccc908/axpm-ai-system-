import { NextResponse } from "next/server";
import {
  getWeChatWorkConfig,
  handleWeChatWorkEvent,
  verifyWeChatWorkUrl,
} from "@/lib/integrations/wechat-work";

/** WeChat Work (企业微信) webhook — auto-records incoming messages */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const msg_signature = searchParams.get("msg_signature") ?? "";
  const timestamp = searchParams.get("timestamp") ?? "";
  const nonce = searchParams.get("nonce") ?? "";
  const echostr = searchParams.get("echostr") ?? "";

  const verified = verifyWeChatWorkUrl({ msg_signature, timestamp, nonce, echostr });
  if (verified) {
    return new NextResponse(verified, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      try {
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        body = { raw: text };
      }
    }

    const result = await handleWeChatWorkEvent(body);
    return NextResponse.json({ received: true, ...result, config: getWeChatWorkConfig() });
  } catch (error) {
    console.error("[WeChat Work Webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
