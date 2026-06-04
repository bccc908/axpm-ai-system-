import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDailyReport } from "@/lib/ai/openai";

const schema = z.object({
  clientsDue: z.number(),
  newDeposits: z.number(),
  depositValue: z.number(),
  activeLeads: z.number(),
  followUpNotes: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const report = await generateDailyReport({
      ...parsed.data,
      followUpNotes: parsed.data.followUpNotes ?? [],
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("[AI Daily Report]", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
