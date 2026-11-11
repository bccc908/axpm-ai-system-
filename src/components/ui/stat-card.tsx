import type { LucideIcon } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {subtext ? (
            <p
              className={cn(
                "mt-1.5 text-xs",
                trend === "up" && "text-success",
                trend === "down" && "text-danger",
                (!trend || trend === "neutral") && "text-muted",
              )}
            >
              {subtext}
            </p>
          ) : null}
        </div>
        <div className="rounded-md border border-card-border bg-surface-2 p-2">
          <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
}
