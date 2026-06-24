import { cn } from "@/lib/utils";

const variants = {
  default: "border-accent/35 bg-accent/15 text-accent",
  success: "border-success/35 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-danger/35 bg-danger/10 text-danger",
  muted: "border-card-border bg-white/5 text-muted",
} as const;

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
