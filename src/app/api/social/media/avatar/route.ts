import fs from "fs/promises";
import { NextResponse } from "next/server";
import {
  getPresenterMeta,
  hasPresenterPhoto,
  savePresenterPhoto,
} from "@/lib/social/presenter-avatar";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

export async function GET() {
  const hasPhoto = await hasPresenterPhoto();
  const meta = await getPresenterMeta();
  return NextResponse.json({
    hasPhoto,
    meta,
    url: hasPhoto ? `/api/social/media/avatar/file?t=${Date.now()}` : null,
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传照片（photo 字段）" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "仅支持 JPG / PNG / WebP" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "照片请小于 8MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = await savePresenterPhoto(buffer, file.type);
    return NextResponse.json({
      ok: true,
      meta,
      url: `/api/social/media/avatar/file?t=${Date.now()}`,
    });
  } catch (error) {
    console.error("[Avatar Upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传失败" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const { getAvatarPath, getAvatarDir } = await import("@/lib/social/presenter-avatar");
    await fs.unlink(getAvatarPath()).catch(() => undefined);
    await fs.unlink(`${getAvatarDir()}/meta.json`).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
