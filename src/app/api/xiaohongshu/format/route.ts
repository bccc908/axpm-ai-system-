import { NextResponse } from "next/server";
import { formatXhsPost, getXhsConfig } from "@/lib/integrations/xiaohongshu";

export async function GET() {
  const config = getXhsConfig();
  return NextResponse.json({
    configured: config.configured,
    openPlatformUrl: config.openPlatformUrl,
    creatorUrl: config.creatorUrl,
    envKeys: ["XHS_APP_KEY", "XHS_APP_SECRET", "XHS_ACCESS_TOKEN"],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();
    if (!content && !title) {
      return NextResponse.json({ error: "title or content required" }, { status: 400 });
    }
    const formatted = formatXhsPost({
      title: title || content.slice(0, 20),
      content,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    });
    const copyText = `${formatted.title}\n\n${formatted.content}`;
    return NextResponse.json({
      ...formatted,
      copyText,
      creatorUrl: getXhsConfig().creatorUrl,
    });
  } catch {
    return NextResponse.json({ error: "Format failed" }, { status: 500 });
  }
}
