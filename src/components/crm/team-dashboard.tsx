"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { Client, FollowUp, TeamMember } from "@/types/database";

export function TeamDashboard() {
  const { t } = useLocale();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, clientRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/clients"),
      ]);
      const [teamData, clientData] = await Promise.all([teamRes.json(), clientRes.json()]);
      setMembers(teamData.teamMembers ?? []);
      setFollowUps(teamData.followUps ?? []);
      setClients(clientData.clients ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("team.title")}</h1>
        <p className="mt-1 text-muted">{t("team.subtitle")}</p>
      </div>

      <Card>
        <CardHeader title={t("team.members")} description={t("team.membersCount", { count: members.length })} />
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((member) => (
              <div key={member.id} className="rounded-lg border border-card-border bg-background/50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{member.name}</p>
                    <p className="text-sm text-muted">{member.email}</p>
                  </div>
                  <Badge variant={member.role === "admin" ? "default" : "muted"}>{member.role}</Badge>
                </div>
                {member.telegram_id && (
                  <p className="mt-2 text-xs text-muted">Telegram: {member.telegram_id}</p>
                )}
                <p className="mt-2 text-xs text-muted">
                  {t("team.clientsAssigned")}: {clients.filter((c) => c.assigned_to === member.id).length}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={t("team.recentFollowUps")} />
        <div className="space-y-3">
          {followUps.map((fu) => {
            const client = clients.find((c) => c.id === fu.client_id);
            return (
              <div key={fu.id} className="rounded-lg border border-card-border bg-background/50 px-4 py-3">
                <p className="font-medium text-foreground">{client?.name ?? "—"}</p>
                <p className="text-sm text-muted">{fu.summary ?? fu.notes}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
