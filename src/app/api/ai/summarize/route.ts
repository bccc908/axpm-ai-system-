import { NextResponse } from "next/server";
import { z } from "zod";
import { summarizeConversation } from "@/lib/ai/openai";

const schema = z.object({
  clientName: z.string().min(1),
  messages: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await summarizeConversation(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[AI Summarize]", error);
    return NextResponse.json({ error: "Failed to summarize" }, { status: 500 });
  }
}
