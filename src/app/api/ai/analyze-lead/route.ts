import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeLead } from "@/lib/ai/openai";

const schema = z.object({
  clientName: z.string().min(1),
  leadStatus: z.string(),
  depositAmount: z.number(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await analyzeLead(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[AI Analyze Lead]", error);
    return NextResponse.json({ error: "Failed to analyze lead" }, { status: 500 });
  }
}
