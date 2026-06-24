import { NextResponse } from "next/server";
import { getClientTimeline } from "@/lib/crm/pro-store";
import { listClients } from "@/lib/crm/store";
import { listDeals } from "@/lib/crm/pro-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const [timeline, clients, deals] = await Promise.all([
    getClientTimeline(id),
    listClients(),
    listDeals({ client_id: id }),
  ]);
  const client = clients.find((c) => c.id === id);
  if (!client) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json({ client, timeline, deals });
}
