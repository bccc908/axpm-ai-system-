import { cn } from "@/lib/utils";
import { PUBLIC_BRAND } from "@/lib/brand/public-brand";

export function BrandLogo({
  className,
  height = 28,
  tone = "dark",
  priority = false,
}: {
  className?: string;
  height?: number;
  /** Kept so existing call sites stay unchanged. */
  tone?: "dark" | "light";
  priority?: boolean;
}) {
  void tone;
  void priority;
  return (
    <span
      className={cn("block shrink-0 font-semibold tracking-tight text-foreground", className)}
      style={{ fontSize: Math.max(13, Math.round(height * 0.52)), lineHeight: 1.2 }}
      aria-label={PUBLIC_BRAND}
    >
      {PUBLIC_BRAND}
    </span>
  );
}
