import { NextResponse } from "next/server";
import { fortuneGenerateSchema, handleFortuneGenerate } from "@/lib/fortune/generate-handler";
import { CustomerApiAuthError, resolveCustomerFromApiKey } from "@/lib/customer/api-auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const auth = await resolveCustomerFromApiKey(request, { checkQuota: true });
    const parsed = fortuneGenerateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await handleFortuneGenerate({
      userId: auth.user.id,
      role: auth.user.role,
      body: parsed.data,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof CustomerApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[v1 fortune generate]", error);
    return NextResponse.json({ error: "Failed to generate reading" }, { status: 500 });
  }
}
