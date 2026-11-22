import { Badge } from "@/components/ui/badge";
import type { KnowledgeStatus } from "@/lib/knowledge-base/sections";

const STATUS_KEY: Record<KnowledgeStatus, string> = {
  template: "knowledge.statusTemplate",
  draft: "knowledge.statusDraft",
  approved: "knowledge.statusApproved",
};

export function KnowledgeStatusBadge({
  status,
  label,
}: {
  status: KnowledgeStatus;
  label: string;
}) {
  if (status === "approved") {
    return (
      <Badge className="border-secondary/40 bg-secondary/10 text-secondary">{label}</Badge>
    );
  }
  if (status === "draft") {
    return <Badge variant="warning">{label}</Badge>;
  }
  return <Badge variant="muted">{label}</Badge>;
}

export function knowledgeStatusKey(status: KnowledgeStatus) {
  return STATUS_KEY[status];
}
