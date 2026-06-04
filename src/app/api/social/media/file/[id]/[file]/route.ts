import fs from "fs/promises";
import { NextResponse } from "next/server";
import { resolveExportFile } from "@/lib/social/media-export";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; file: string }> },
) {
  try {
    const { id, file } = await context.params;
    const filePath = resolveExportFile(id, decodeURIComponent(file));
    const buffer = await fs.readFile(filePath);
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
    const type = MIME[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": type,
        "Cache-Control": ext === ".mp4" ? "no-store, no-cache" : "public, max-age=86400",
        "Content-Disposition": `inline; filename="${file}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
