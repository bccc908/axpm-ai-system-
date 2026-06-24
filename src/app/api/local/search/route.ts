import { NextResponse } from "next/server";
import { z } from "zod";
import { searchWeb } from "@/lib/ai/web-search";
import { assertLocalApiAuth, LocalApiAuthError } from "@/lib/local/local-api-auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  query: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    assertLocalApiAuth(request);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await searchWeb(parsed.data.query);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof LocalApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[Local Search]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
