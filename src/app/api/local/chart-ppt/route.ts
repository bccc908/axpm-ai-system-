import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMarketChartPpt } from "@/lib/ai/market-charts";
import { assertLocalApiAuth, LocalApiAuthError } from "@/lib/local/local-api-auth";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const schema = z.object({
  topic: z.string().min(1).max(500),
  context: z.string().max(8000).optional(),
});

export async function POST(request: Request) {
  try {
    assertLocalApiAuth(request);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await generateMarketChartPpt(parsed.data.topic, parsed.data.context);

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      title: result.output.title,
      outputId: result.output.id,
      downloadUrl: result.downloadUrl,
      csvUrl: result.csvUrl,
      chartCount: result.chartCount,
      slideCount: result.slideCount,
    });
  } catch (error) {
    if (error instanceof LocalApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[Local Chart PPT]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chart PPT generation failed" },
      { status: 500 },
    );
  }
}
