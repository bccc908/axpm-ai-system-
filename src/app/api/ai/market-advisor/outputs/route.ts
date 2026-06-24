import { NextResponse } from "next/server";
import { listMarketOutputs, marketOutputFileUrl } from "@/lib/ai/market-outputs";

export const dynamic = "force-dynamic";

export async function GET() {
  const outputs = await listMarketOutputs(20);
  return NextResponse.json(
    {
      outputs: outputs.map((o) => ({
        ...o,
        files: o.files.map((f) => ({
          name: f,
          url: marketOutputFileUrl(o.id, f),
        })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
