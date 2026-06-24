import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { fortuneGenerateSchema, handleFortuneGenerate } from "@/lib/fortune/generate-handler";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const ctx = await getServerSession();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = fortuneGenerateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await handleFortuneGenerate({
      userId: ctx.user.id,
      role: ctx.user.role,
      body: parsed.data,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[Fortune generate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate reading" },
      { status: 500 },
    );
  }
}
