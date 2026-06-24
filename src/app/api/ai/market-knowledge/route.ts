import { NextResponse } from "next/server";
import { listMarketKnowledgeFiles } from "@/lib/ai/market-knowledge";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const allFiles = await listMarketKnowledgeFiles();
  const files =
    category === "market" || category === "data"
      ? allFiles.filter((f) => f.category === category)
      : allFiles;

  return NextResponse.json(
    {
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        charCount: f.charCount,
        category: f.category,
        uploaded_at: f.uploaded_at,
        preview: f.text.slice(0, 120),
        analysis: f.analysis ?? null,
        stored: Boolean(f.storedFile),
        downloadUrl: f.storedFile ? `/api/ai/market-knowledge/${f.id}/file` : null,
      })),
      counts: {
        total: allFiles.length,
        market: allFiles.filter((f) => f.category === "market").length,
        data: allFiles.filter((f) => f.category === "data").length,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
