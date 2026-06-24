import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccount, listAccounts } from "@/lib/crm/zoho-store";

const createSchema = z.object({
  name: z.string().min(1),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const accounts = await listAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const account = await createAccount({
      name: parsed.data.name,
      website: parsed.data.website ?? null,
      phone: parsed.data.phone ?? null,
      industry: parsed.data.industry ?? null,
      notes: parsed.data.notes ?? null,
      assigned_to: parsed.data.assigned_to ?? null,
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("[CRM Accounts POST]", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
