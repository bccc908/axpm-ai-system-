import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { marketPreviewFilePath } from "@/lib/ai/market-image-preview";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; file: string }> },
) {
  try {
    const { id, file } = await context.params;
    const filename = decodeURIComponent(file).split("?")[0];
    const filePath = marketPreviewFilePath(id, filename);

    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "Preview file not found" }, { status: 404 });
    }

    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const type = ext === ".png" ? "image/png" : "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Market Preview File]", error);
    return NextResponse.json({ error: "Preview load failed" }, { status: 500 });
  }
}
