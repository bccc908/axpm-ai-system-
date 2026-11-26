import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDueScheduledPosts,
  getPost,
  markPostPublished,
} from "@/lib/social/store";
import { publishPostToPlatforms } from "@/lib/social/publish";
import { OWNER_ADMIN, allowCronOrRoles } from "@/lib/auth/route-guard";

async function isAuthorized(request: Request) {
  return allowCronOrRoles(request, OWNER_ADMIN);
}

const bodySchema = z.object({
  post_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPublish();
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);

    if (parsed.success && parsed.data.post_id) {
      const post = await getPost(parsed.data.post_id);
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      const results = await publishPostToPlatforms(post);
      const updated = await markPostPublished(post.id, results);
      return NextResponse.json({ post: updated, results });
    }

    return runPublish();
  } catch (error) {
    console.error("[Social Publish]", error);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}

async function runPublish() {
  const due = await getDueScheduledPosts();
  const output: Record<string, unknown>[] = [];

  for (const post of due) {
    const results = await publishPostToPlatforms(post);
    const updated = await markPostPublished(post.id, results);
    output.push({ post_id: post.id, results, status: updated?.status });
  }

  return NextResponse.json({ published: output.length, output });
}
