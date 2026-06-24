import { NextResponse } from "next/server";
import { getPipelineBoard } from "@/lib/crm/pro-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pipelineId = url.searchParams.get("pipeline_id") ?? undefined;
  const board = await getPipelineBoard(pipelineId ?? undefined);
  return NextResponse.json(board);
}
