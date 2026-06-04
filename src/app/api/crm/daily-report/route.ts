import { NextResponse } from "next/server";
import { generateDailyReport } from "@/lib/ai/openai";
import { getCrmOverview, saveDailyReport } from "@/lib/crm/store";
import { listClients } from "@/lib/crm/store";

export async function POST() {
  try {
    const [overview, clients] = await Promise.all([getCrmOverview(), listClients()]);

    const activeLeads = clients.filter((c) =>
      ["contacted", "qualified", "negotiating"].includes(c.lead_status),
    ).length;

    const report = await generateDailyReport({
      clientsDue: overview.followUpsDueToday,
      newDeposits: clients.filter((c) => c.deposit_amount > 0).length,
      depositValue: overview.totalDeposits,
      activeLeads,
      followUpNotes: overview.clientsDueToday.map((c) => c.name),
    });

    const saved = await saveDailyReport({
      report_date: new Date().toISOString().split("T")[0],
      content: report,
      metrics: {
        total_clients: overview.totalClients,
        follow_ups_due: overview.followUpsDueToday,
        total_deposits: overview.totalDeposits,
        active_leads: activeLeads,
        pending_tasks: overview.pendingTasks,
      },
    });

    return NextResponse.json({ report: saved });
  } catch (error) {
    console.error("[CRM Daily Report]", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
