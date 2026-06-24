import { NextResponse } from "next/server";
import { readMarketKnowledgeBinary } from "@/lib/ai/market-knowledge";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await readMarketKnowledgeBinary(id);
    if (!result) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const { entry, buffer } = result;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": entry.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(entry.name)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Market Knowledge File]", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
