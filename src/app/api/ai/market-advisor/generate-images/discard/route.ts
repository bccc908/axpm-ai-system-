import { NextResponse } from "next/server";
import { discardMarketImagePreview } from "@/lib/ai/market-image-preview";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const previewId = typeof body.previewId === "string" ? body.previewId : "";
    if (!previewId) {
      return NextResponse.json({ error: "previewId required" }, { status: 400 });
    }

    await discardMarketImagePreview(previewId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Market Discard Preview]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discard failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  return POST(request);
}
