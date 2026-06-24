import { NextResponse } from "next/server";
import {
  deleteMarketDiaryEntry,
  groupDiaryByDate,
  listMarketDiaryEntries,
} from "@/lib/ai/market-diary";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await listMarketDiaryEntries(200);
  return NextResponse.json(
    {
      entries,
      grouped: groupDiaryByDate(entries),
      total: entries.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const ok = await deleteMarketDiaryEntry(id);
    if (!ok) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Market Diary DELETE]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
