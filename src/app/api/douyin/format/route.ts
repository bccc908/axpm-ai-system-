import { NextResponse } from "next/server";
import { formatDouyinPost, getDouyinConfig } from "@/lib/integrations/douyin";

export async function GET() {
  const config = getDouyinConfig();
  return NextResponse.json({
    configured: config.configured,
    apiReady: config.apiReady,
    openPlatformUrl: config.openPlatformUrl,
    creatorUrl: config.creatorUrl,
    envKeys: ["DOUYIN_CLIENT_KEY", "DOUYIN_CLIENT_SECRET", "DOUYIN_ACCESS_TOKEN"],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const script = String(body.script ?? "").trim();
    const content = String(body.content ?? "").trim();
    if (!content && !script && !title) {
      return NextResponse.json({ error: "title or content required" }, { status: 400 });
    }
    const formatted = formatDouyinPost({
      title: title || content.slice(0, 55) || script.slice(0, 55),
      content: content || script,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    });
    const copyText = script
      ? `【标题】\n${formatted.title}\n\n【口播稿】\n${script}\n\n【发布描述】\n${formatted.content}`
      : `【标题】\n${formatted.title}\n\n【描述】\n${formatted.content}`;
    return NextResponse.json({
      ...formatted,
      copyText,
      creatorUrl: getDouyinConfig().creatorUrl,
    });
  } catch {
    return NextResponse.json({ error: "Format failed" }, { status: 500 });
  }
}
