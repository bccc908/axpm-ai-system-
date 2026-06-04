import { NextResponse } from "next/server";
import { z } from "zod";
import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { getDeepSeekModel, getDeepSeekReasonerModel } from "@/lib/ai/deepseek-config";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().min(1),
  system: z.string().optional(),
  model: z.enum(["deepseek-chat", "deepseek-reasoner"]).optional(),
  json: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const model =
      parsed.data.model === "deepseek-reasoner"
        ? getDeepSeekReasonerModel()
        : getDeepSeekModel();

    const messages: { role: "system" | "user"; content: string }[] = [];
    if (parsed.data.system?.trim()) {
      messages.push({ role: "system", content: parsed.data.system.trim() });
    }
    messages.push({ role: "user", content: parsed.data.message.trim() });

    const result = await deepSeekChat({
      messages,
      model,
      json: parsed.data.json,
      temperature: parsed.data.temperature,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, ok: false }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      provider: "deepseek",
      model: result.model,
      content: result.content,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[DeepSeek Chat]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DeepSeek chat failed" },
      { status: 500 },
    );
  }
}
