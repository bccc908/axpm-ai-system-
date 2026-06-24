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
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/10 blur-2xl"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
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
        <div className="rounded-xl border border-accent/20 bg-accent/10 p-3 shadow-[0_0_24px_-8px_var(--accent-glow)]">
          <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
}
