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
    <header className={cn("mb-8", className)}>
      {badge ? (
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <span className="badge-shimmer rounded-full border border-accent/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            {badge}
          </span>
        </div>
      ) : null}
      <h1 className="font-display text-3xl font-semibold tracking-tight text-gradient-gold md:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
