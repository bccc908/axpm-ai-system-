"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { CrmBoardColumn, CrmPipeline } from "@/types/crm-pro";

export function PipelineBoard() {
  const { t } = useLocale();
  const [pipeline, setPipeline] = useState<CrmPipeline | null>(null);
  const [columns, setColumns] = useState<CrmBoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<string | null>(null);
  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/board");
      const data = await res.json();
      setPipeline(data.pipeline ?? null);
      setColumns(data.columns ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveDeal(dealId: string, stageId: string) {
    if (moving) return;
    setMoving(dealId);
    try {
      await fetch(`/api/crm/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId }),
      });
      await load();
    } finally {
      setMoving(null);
    }
  }

  async function setDealStatus(dealId: string, status: "won" | "lost") {
    setMoving(dealId);
    try {
      await fetch(`/api/crm/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setMoving(null);
    }
  }

  function handleDrop(stageId: string) {
    if (dragDealId) void moveDeal(dragDealId, stageId);
    setDragDealId(null);
    setDropStageId(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{pipeline?.name}</h2>
        <p className="text-sm text-muted">{t("crmPro.pipelineDragHint")}</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map(({ stage, deals }) => (
          <div
            key={stage.id}
            className={`flex min-w-[260px] max-w-[280px] flex-1 flex-col rounded-2xl border bg-card/50 transition-colors ${
              dropStageId === stage.id ? "border-accent bg-accent/5" : "border-card-border"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropStageId(stage.id);
            }}
            onDragLeave={() => setDropStageId(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(stage.id);
            }}
          >
            <div
              className="border-b border-card-border px-4 py-3"
              style={{ borderTopColor: `#${stage.color}`, borderTopWidth: 3 }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{stage.name}</p>
                <Badge variant="muted">{deals.length}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{stage.probability}% avg</p>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-3 min-h-[120px]">
              {deals.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted">{t("crmPro.noDeals")}</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragDealId(deal.id)}
                    onDragEnd={() => {
                      setDragDealId(null);
                      setDropStageId(null);
                    }}
                  >
                    <Card
                      className={`cursor-grab p-3 shadow-sm active:cursor-grabbing ${
                        moving === deal.id ? "opacity-60" : ""
                      } ${dragDealId === deal.id ? "ring-2 ring-accent/40" : ""}`}
                    >
                    <Link
                      href={`/dashboard/clients/${deal.client_id}`}
                      className="font-medium text-foreground hover:text-accent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {deal.client_name}
                    </Link>
                    <p className="mt-1 text-sm text-muted line-clamp-2">{deal.title}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatCurrency(deal.amount, deal.currency)}
                    </p>
                    <div className="mt-3 flex gap-1">
                      <button
                        type="button"
                        title={t("crmPro.markWon")}
                        disabled={moving === deal.id}
                        onClick={() => void setDealStatus(deal.id, "won")}
                        className="rounded-lg border border-success/30 p-1.5 text-success hover:bg-success/10"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title={t("crmPro.markLost")}
                        disabled={moving === deal.id}
                        onClick={() => void setDealStatus(deal.id, "lost")}
                        className="rounded-lg border border-danger/30 p-1.5 text-danger hover:bg-danger/10"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Card>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
