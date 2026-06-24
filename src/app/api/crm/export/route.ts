import { NextResponse } from "next/server";
import { exportContactsCsv, exportLeadsCsv } from "@/lib/crm/zoho-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type === "leads") {
    const csv = await exportLeadsCsv();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="axpm-leads.csv"',
      },
    });
  }

  if (type === "contacts") {
    const csv = await exportContactsCsv();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="axpm-contacts.csv"',
      },
    });
  }

  return NextResponse.json({ error: "type must be leads or contacts" }, { status: 400 });
}
