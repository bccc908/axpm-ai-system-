import { NextResponse } from "next/server";
import { z } from "zod";
import { convertLead } from "@/lib/crm/zoho-store";

const schema = z.object({
  dealTitle: z.string().optional(),
  dealAmount: z.number().optional(),
  accountName: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await convertLead(id, parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[CRM Lead convert]", error);
    return NextResponse.json({ error: "Failed to convert lead" }, { status: 500 });
  }
}
