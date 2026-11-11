import { cn } from "@/lib/utils";

export function PageHeader({
  badge,
  title,
  subtitle,
  icon,
  className,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 border-b border-card-border pb-5", className)}>
      {badge ? (
        <div className="mb-2 flex items-center gap-2 text-muted">
          {icon}
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {badge}
          </span>
        </div>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[26px]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
