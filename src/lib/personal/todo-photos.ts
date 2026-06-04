import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { TodoPhoto } from "@/types/personal";
import { readPersonalData, updateTodo } from "@/lib/personal/store";

export const TODO_PHOTOS_DIR = path.join(process.cwd(), "data", "todo-photos");

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function ensureTodoPhotosDir() {
  await fs.mkdir(TODO_PHOTOS_DIR, { recursive: true });
}

export async function addTodoPhoto(todoId: string, file: File): Promise<TodoPhoto> {
  const mimeType = file.type || "image/jpeg";
  if (!mimeType.startsWith("image/") && !ALLOWED.has(mimeType)) {
    throw new Error("Only image files are supported");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image too large (max 8MB)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const filename = `${todoId}-${randomUUID()}.${ext}`;

  await ensureTodoPhotosDir();
  await fs.writeFile(path.join(TODO_PHOTOS_DIR, filename), buffer);

  const photo: TodoPhoto = {
    id: randomUUID(),
    filename,
    mimeType,
    size: file.size,
    uploaded_at: new Date().toISOString(),
  };

  const data = await readPersonalData();
  const todo = data.todos.find((t) => t.id === todoId);
  if (!todo) {
    await fs.unlink(path.join(TODO_PHOTOS_DIR, filename)).catch(() => undefined);
    throw new Error("Todo not found");
  }

  const photos = [...(todo.photos ?? []), photo];
  await updateTodo(todoId, { photos });
  return photo;
}

export async function deleteTodoPhoto(todoId: string, photoId: string) {
  const data = await readPersonalData();
  const todo = data.todos.find((t) => t.id === todoId);
  if (!todo) return false;

  const photo = (todo.photos ?? []).find((p) => p.id === photoId);
  if (!photo) return false;

  await fs.unlink(path.join(TODO_PHOTOS_DIR, photo.filename)).catch(() => undefined);
  await updateTodo(todoId, {
    photos: (todo.photos ?? []).filter((p) => p.id !== photoId),
  });
  return true;
}

export async function getTodoPhotoFile(filename: string) {
  const safe = path.basename(filename);
  const full = path.join(TODO_PHOTOS_DIR, safe);
  const buffer = await fs.readFile(full);
  return { buffer, path: full };
}
