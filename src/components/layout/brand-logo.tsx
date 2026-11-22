import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Official AXPM wordmark (https://axpmprime.com/assets/img/logo.png).
 * Navy #00344d is ~1.4:1 on #111521, so the dark file keeps the same
 * drawing and recolors only that stroke to brand teal #089fac (5.7:1).
 * Orange stays the logo orange. Light backgrounds use the official navy.
 * Intrinsic size of both files: 2058×543.
 */
const WORDMARK = {
  dark: "/brand/axpm-logo-dark.png",
  light: "/brand/axpm-logo.png",
} as const;

const INTRINSIC = { width: 2058, height: 543 };

export function BrandLogo({
  className,
  height = 28,
  tone = "dark",
  priority = false,
}: {
  className?: string;
  height?: number;
  /** `dark` for #111521 and other dark surfaces. `light` for light backgrounds. */
  tone?: keyof typeof WORDMARK;
  priority?: boolean;
}) {
  const width = Math.round((height * INTRINSIC.width) / INTRINSIC.height);
  return (
    <Image
      src={WORDMARK[tone]}
      alt="AXPM"
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={cn("block h-auto w-auto max-w-full shrink-0", className)}
      style={{ height, width: "auto" }}
    />
  );
}
