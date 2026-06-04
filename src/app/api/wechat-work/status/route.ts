import { NextResponse } from "next/server";
import { getWeChatWorkConfig } from "@/lib/integrations/wechat-work";

export async function GET() {
  const config = getWeChatWorkConfig();
  return NextResponse.json({
    wechatWork: config,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/webhooks/wechat-work`,
  });
}
