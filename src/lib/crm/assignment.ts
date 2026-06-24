import "server-only";

import { readAppSettings, writeAppSettings } from "@/lib/finance/settings";
import { listTeamMembers, updateClient } from "@/lib/crm/store";

export async function assignNextTeamMember(): Promise<string | null> {
  const settings = await readAppSettings();
  if (settings.crmWidgetAutoAssign === false) return null;

  const members = (await listTeamMembers()).filter((m) => m.is_active);
  if (!members.length) return null;

  const index = settings.crmAssignmentIndex ?? 0;
  const member = members[index % members.length];

  await writeAppSettings({
    crmAssignmentIndex: (index + 1) % members.length,
  });

  return member.id;
}

export async function autoAssignWebLead(clientId: string) {
  const assigneeId = await assignNextTeamMember();
  if (!assigneeId) return null;

  const client = await updateClient(clientId, { assigned_to: assigneeId });
  if (client) {
    const { createActivity } = await import("@/lib/crm/pro-store");
    const members = await listTeamMembers();
    const member = members.find((m) => m.id === assigneeId);
    await createActivity({
      client_id: clientId,
      type: "status_change",
      title: "Lead assigned",
      body: member ? `Assigned to ${member.name}` : "Assigned to team member",
      actor_name: "CRM Auto-assign",
    });
  }
  return client;
}
