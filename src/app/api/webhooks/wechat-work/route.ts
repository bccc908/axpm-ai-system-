import { NextResponse } from "next/server";
import { verifyWeChatWorkUrl } from "@/lib/integrations/wechat-work";

/**
 * WeChat Work (企业微信) webhook.
 *
 * GET keeps the URL-verification handshake.
 *
 * POST fails closed. Real WeCom callbacks are AES-encrypted XML signed with
 * msg_signature over the Encrypt field; this app can't verify or decrypt them
 * yet (CH-3). Until it can, every POST is rejected so nobody can forge inbound
 * messages or create clients through this route. No config is echoed back.
 */
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

export async function POST(_request: Request) {
  void _request;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
