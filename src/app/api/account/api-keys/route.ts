import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/api-session";
import {
  createCustomerApiKey,
  deleteCustomerApiKey,
  listCustomerApiKeys,
} from "@/lib/customer/store";

const createSchema = z.object({
  label: z.string().min(1).max(80),
});

export async function GET() {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await listCustomerApiKeys(ctx.user.id);
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid label" }, { status: 400 });
  }

  const created = await createCustomerApiKey(ctx.user.id, parsed.data.label);
  return NextResponse.json({
    ok: true,
    key: created.key,
    secret: created.secret,
  });
}

export async function DELETE(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });
  }

  const deleted = await deleteCustomerApiKey(ctx.user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
