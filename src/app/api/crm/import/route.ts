import { NextResponse } from "next/server";
import { z } from "zod";
import { importContactsFromCsv, importLeadsFromCsv } from "@/lib/crm/zoho-store";

const schema = z.object({
  type: z.enum(["leads", "contacts"]),
  csv: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result =
      parsed.data.type === "leads"
        ? await importLeadsFromCsv(parsed.data.csv)
        : await importContactsFromCsv(parsed.data.csv);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[CRM Import]", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
