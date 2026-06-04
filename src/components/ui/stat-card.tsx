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
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          {subtext && (
            <p
              className={cn(
                "mt-1 text-xs",
                trend === "up" && "text-success",
                trend === "down" && "text-danger",
                (!trend || trend === "neutral") && "text-muted",
              )}
            >
              {subtext}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-accent/10 p-2.5">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      </div>
    </Card>
  );
}
