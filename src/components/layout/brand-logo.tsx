import { cn } from "@/lib/utils";

/**
 * Typographic KD wordmark. There is no logo asset for this brand pass.
 */
export function BrandLogo({
  className,
  height = 28,
  tone = "dark",
  priority = false,
}: {
  className?: string;
  height?: number;
  /** `dark` for dark surfaces. `light` for light backgrounds. */
  tone?: "dark" | "light";
  /** Accepted so existing image call sites keep type-checking. Text has no fetch priority. */
  priority?: boolean;
}) {
  void priority;
  const fontSize = Math.max(14, Math.round(height * 0.72));
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center font-semibold leading-none tracking-[0.04em]",
        tone === "light" ? "text-[#00344d]" : "text-foreground",
        className,
      )}
      style={{ height, fontSize }}
    >
      KD
    </span>
  );
}
