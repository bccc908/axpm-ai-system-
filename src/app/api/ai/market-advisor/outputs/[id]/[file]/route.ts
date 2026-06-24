import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getMarketOutput, marketOutputFilePath } from "@/lib/ai/market-outputs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; file: string }> },
) {
  try {
    const { id, file } = await context.params;
    const output = await getMarketOutput(id);
    if (!output) {
      return NextResponse.json({ error: "Output not found" }, { status: 404 });
    }

    const filename = decodeURIComponent(file);
    if (!output.files.includes(filename)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filePath = marketOutputFilePath(id, filename);
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const type =
      ext === ".pptx"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : ext === ".png"
          ? "image/png"
          : "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Market Output File]", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
