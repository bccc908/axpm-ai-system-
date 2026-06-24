import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import { updateCustomerIntegrations } from "@/lib/customer/store";

const schema = z.object({
  deepseek_api_key: z.string().max(200).nullable().optional(),
  deepseek_base_url: z.string().max(200).nullable().optional(),
  deepseek_model: z.string().max(80).nullable().optional(),
});

export async function PATCH(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid integration data" }, { status: 400 });
  }

  const account = await updateCustomerIntegrations(ctx.user.id, {
    deepseek_api_key:
      parsed.data.deepseek_api_key === undefined
        ? undefined
        : parsed.data.deepseek_api_key?.trim() || null,
    deepseek_base_url:
      parsed.data.deepseek_base_url === undefined
        ? undefined
        : parsed.data.deepseek_base_url?.trim() || null,
    deepseek_model:
      parsed.data.deepseek_model === undefined
        ? undefined
        : parsed.data.deepseek_model?.trim() || null,
  });

  return NextResponse.json({
    ok: true,
    deepseek_configured: Boolean(account.integrations.deepseek_api_key?.trim()),
  });
}
