import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { SocialData, SocialPlatform, SocialPost, SocialPostStatus } from "@/types/social";

const DATA_FILE = path.join(process.cwd(), "data", "social-posts.json");

async function ensureFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ posts: [] }, null, 2));
  }
}

async function readData(): Promise<SocialData> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as SocialData;
}

async function writeData(data: SocialData) {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function listPosts(status?: SocialPostStatus) {
  const data = await readData();
  let posts = data.posts.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (status) posts = posts.filter((p) => p.status === status);
  return posts;
}

export async function getPost(id: string) {
  const data = await readData();
  return data.posts.find((p) => p.id === id) ?? null;
}

export async function createPost(input: {
  title: string;
  content: string;
  image_url?: string | null;
  platforms: SocialPlatform[];
  locale?: "en" | "zh" | "both";
  status?: SocialPostStatus;
  scheduled_at?: string | null;
}) {
  const data = await readData();
  const now = new Date().toISOString();
  const post: SocialPost = {
    id: randomUUID(),
    title: input.title.trim(),
    content: input.content.trim(),
    image_url: input.image_url?.trim() || null,
    platforms: input.platforms,
    locale: input.locale ?? "both",
    status: input.status ?? (input.scheduled_at ? "scheduled" : "draft"),
    scheduled_at: input.scheduled_at ?? null,
    published_at: null,
    publish_results: {},
    created_at: now,
    updated_at: now,
  };
  data.posts.unshift(post);
  await writeData(data);
  return post;
}

export async function updatePost(
  id: string,
  patch: Partial<
    Pick<SocialPost, "title" | "content" | "image_url" | "platforms" | "locale" | "status" | "scheduled_at">
  >,
) {
  const data = await readData();
  const index = data.posts.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const current = data.posts[index];
  const updated: SocialPost = {
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
  };
  data.posts[index] = updated;
  await writeData(data);
  return updated;
}

export async function markPostPublished(
  id: string,
  results: SocialPost["publish_results"],
) {
  const data = await readData();
  const index = data.posts.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const allOk = Object.values(results).every((r) => r?.ok);
  const anyOk = Object.values(results).some((r) => r?.ok);

  data.posts[index] = {
    ...data.posts[index],
    publish_results: results,
    status: allOk ? "published" : anyOk ? "published" : "failed",
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await writeData(data);
  return data.posts[index];
}

export async function deletePost(id: string) {
  const data = await readData();
  const before = data.posts.length;
  data.posts = data.posts.filter((p) => p.id !== id);
  if (data.posts.length === before) return false;
  await writeData(data);
  return true;
}

export async function getDueScheduledPosts() {
  const data = await readData();
  const now = Date.now();
  return data.posts.filter(
    (p) =>
      p.status === "scheduled" &&
      p.scheduled_at &&
      new Date(p.scheduled_at).getTime() <= now,
  );
}
