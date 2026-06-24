import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountDetail, updateAccount } from "@/lib/crm/zoho-store";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  custom_fields: z.record(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await getAccountDetail(id);
  if (!detail) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const account = await updateAccount(id, parsed.data);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ account: { ...account, custom_fields: account.custom_fields ?? {} } });
  } catch (error) {
    console.error("[CRM Account PATCH]", error);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}
