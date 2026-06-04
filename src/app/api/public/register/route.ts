import { NextResponse } from "next/server";
import { z } from "zod";
import { getRegisterUrl, registerClientFromForm } from "@/lib/crm/auto-client";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  wechat: z.string().max(80).optional(),
  ib_source: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
});

export async function GET() {
  return NextResponse.json({
    registerUrl: getRegisterUrl(),
    enabled: true,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const emptyToNull = (v?: string) => (v?.trim() ? v.trim() : null);

    const result = await registerClientFromForm({
      name: parsed.data.name.trim(),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      whatsapp: emptyToNull(parsed.data.whatsapp),
      wechat: emptyToNull(parsed.data.wechat),
      ib_source: emptyToNull(parsed.data.ib_source),
      message: emptyToNull(parsed.data.message),
    });

    if (!result.client) {
      return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        created: result.created,
        client: {
          id: result.client.id,
          name: result.client.name,
        },
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error("[Public Register]", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
