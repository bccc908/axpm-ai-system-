import "server-only";

import { readCrmData } from "@/lib/crm/store";
import { getCrmReports } from "@/lib/crm/pro-store";

export type LeadSourceStat = {
  source: string;
  count: number;
};

export type MonthlyDealTrend = {
  month: string;
  label: string;
  won: number;
  lost: number;
  wonValue: number;
};

export type TeamPerformanceRow = {
  member_id: string;
  name: string;
  open_deals: number;
  won_deals: number;
  won_value: number;
};

export type CrmAdvancedAnalytics = {
  leadConversionRate: number;
  totalLeads: number;
  convertedLeads: number;
  openLeads: number;
  leadSources: LeadSourceStat[];
  monthlyTrend: MonthlyDealTrend[];
  teamPerformance: TeamPerformanceRow[];
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export async function getCrmAdvancedAnalytics(): Promise<CrmAdvancedAnalytics> {
  const data = await readCrmData();
  const leads = data.leads ?? [];
  const convertedLeads = leads.filter((l) => l.status === "converted");
  const openLeads = leads.filter(
    (l) => l.status !== "converted" && l.status !== "unqualified",
  );

  const sourceMap = new Map<string, number>();
  for (const lead of leads) {
    const key = (lead.source?.trim() || "unknown").toLowerCase();
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + 1);
  }
  const leadSources = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(monthKey(d));
  }

  const monthlyTrend = monthKeys.map((key) => {
    const wonInMonth = data.deals.filter((deal) => {
      if (deal.status !== "won") return false;
      const ref = deal.close_date ?? deal.updated_at;
      return monthKey(new Date(ref)) === key;
    });
    const lostInMonth = data.deals.filter((deal) => {
      if (deal.status !== "lost") return false;
      const ref = deal.close_date ?? deal.updated_at;
      return monthKey(new Date(ref)) === key;
    });
    return {
      month: key,
      label: monthLabel(key),
      won: wonInMonth.length,
      lost: lostInMonth.length,
      wonValue: wonInMonth.reduce((sum, d) => sum + d.amount, 0),
    };
  });

  const teamPerformance = data.teamMembers
    .filter((m) => m.is_active)
    .map((member) => {
      const memberDeals = data.deals.filter((d) => d.assigned_to === member.id);
      const won = memberDeals.filter((d) => d.status === "won");
      return {
        member_id: member.id,
        name: member.name,
        open_deals: memberDeals.filter((d) => d.status === "open").length,
        won_deals: won.length,
        won_value: won.reduce((sum, d) => sum + d.amount, 0),
      };
    })
    .sort((a, b) => b.won_value - a.won_value);

  return {
    leadConversionRate:
      leads.length > 0 ? Math.round((convertedLeads.length / leads.length) * 100) : 0,
    totalLeads: leads.length,
    convertedLeads: convertedLeads.length,
    openLeads: openLeads.length,
    leadSources,
    monthlyTrend,
    teamPerformance,
  };
}

export async function getFullCrmDashboard() {
  const [reports, analytics] = await Promise.all([getCrmReports(), getCrmAdvancedAnalytics()]);
  return { reports, analytics };
}
