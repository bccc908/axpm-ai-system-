import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-panel rounded-lg p-4 md:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-4 mb-4 flex items-start justify-between gap-4 border-b border-card-border px-4 py-3 md:-mx-5 md:-mt-5 md:px-5">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
