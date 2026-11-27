import { cn } from "@/lib/utils";

const WORDMARK =
  'var(--font-inter-tight), var(--font-inter), "Inter", system-ui, sans-serif';

/**
 * Typographic KD wordmark. Letters only — no symbol.
 * auth: 16px #E7E9EE. sidebar: 20px #F2F4F8. header: 16px #F2F4F8.
 */
export function BrandLogo({
  className,
  variant = "sidebar",
  size,
  tone: _tone = "dark",
  priority: _priority = false,
  height: _height,
}: {
  className?: string;
  variant?: "auth" | "sidebar" | "header";
  /** Overrides the variant size. Customer bar uses 18; mobile stays 16. */
  size?: number;
  tone?: "dark" | "light";
  priority?: boolean;
  height?: number;
}) {
  void _tone;
  void _priority;
  void _height;
  const preset = variant === "sidebar" ? 20 : 16;
  const color = variant === "auth" ? "#E7E9EE" : "#F2F4F8";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center leading-none", className)}
      style={{
        fontFamily: WORDMARK,
        fontWeight: 600,
        fontSize: size ?? preset,
        letterSpacing: "0.06em",
        color,
      }}
    >
      KD
    </span>
  );
}
