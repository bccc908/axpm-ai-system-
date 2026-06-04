import { NextResponse } from "next/server";
import { z } from "zod";
import { createPost, listPosts } from "@/lib/social/store";
import { getSocialIntegrationStatus, publishPostToPlatforms } from "@/lib/social/publish";
import { markPostPublished } from "@/lib/social/store";

const platforms = z.enum(["facebook", "instagram", "tiktok", "wechat_oa", "weibo", "douyin", "xiaohongshu"]);

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  image_url: z.string().url().nullable().optional(),
  platforms: z.array(platforms).min(1),
  locale: z.enum(["en", "zh", "both"]).optional(),
  scheduled_at: z.string().nullable().optional(),
  publish_now: z.boolean().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const posts = await listPosts(status as "draft" | "scheduled" | "published" | "failed" | undefined);
  return NextResponse.json({
    posts,
    integrations: getSocialIntegrationStatus(),
    cronUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/social/publish`,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const post = await createPost({
      title: parsed.data.title,
      content: parsed.data.content,
      image_url: parsed.data.image_url,
      platforms: parsed.data.platforms,
      locale: parsed.data.locale,
      scheduled_at: parsed.data.scheduled_at,
      status: parsed.data.scheduled_at ? "scheduled" : "draft",
    });

    if (parsed.data.publish_now) {
      const results = await publishPostToPlatforms(post);
      const updated = await markPostPublished(post.id, results);
      return NextResponse.json({ post: updated, results });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("[Social POST]", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
