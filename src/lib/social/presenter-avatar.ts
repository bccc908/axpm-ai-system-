import "server-only";

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const AVATAR_DIR = path.join(process.cwd(), "data", "social-media", "presenter");
const AVATAR_FILE = "avatar.jpg";
const META_FILE = "meta.json";

export type PresenterMeta = {
  filename: string;
  uploadedAt: string;
  mimeType: string;
};

export function getAvatarDir() {
  return AVATAR_DIR;
}

export function getAvatarPath() {
  return path.join(AVATAR_DIR, AVATAR_FILE);
}

export async function savePresenterPhoto(buffer: Buffer, mimeType: string) {
  await fs.mkdir(AVATAR_DIR, { recursive: true });
  const normalized = await sharp(buffer)
    .rotate()
    .resize(900, 900, { fit: "cover", position: "attention" })
    .sharpen({ sigma: 0.8 })
    .modulate({ brightness: 1.03, saturation: 1.05 })
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
  await fs.writeFile(getAvatarPath(), normalized);
  const meta: PresenterMeta = {
    filename: AVATAR_FILE,
    uploadedAt: new Date().toISOString(),
    mimeType,
  };
  await fs.writeFile(path.join(AVATAR_DIR, META_FILE), JSON.stringify(meta, null, 2));
  return meta;
}

export async function getPresenterMeta(): Promise<PresenterMeta | null> {
  try {
    await fs.access(getAvatarPath());
    const raw = await fs.readFile(path.join(AVATAR_DIR, META_FILE), "utf-8");
    return JSON.parse(raw) as PresenterMeta;
  } catch {
    return null;
  }
}

export async function hasPresenterPhoto() {
  try {
    await fs.access(getAvatarPath());
    return true;
  } catch {
    return false;
  }
}
