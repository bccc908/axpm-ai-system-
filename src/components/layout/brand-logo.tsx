import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Official AXPM logo (source: https://axpmprime.com/assets/img/logo.png).
 * The logo uses navy + orange, so on the dark UI it sits on the brand light plate (#f5f3ef)
 * to keep the navy strokes visible.
 */
export function BrandLogo({
  className,
  height = 22,
}: {
  className?: string;
  height?: number;
}) {
  const width = Math.round((height * 480) / 129);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md bg-brand-light px-2 py-1.5",
        className,
      )}
    >
      <Image
        src="/brand/axpm-logo.png"
        alt="AXPM"
        width={width}
        height={height}
        priority
        style={{ height, width: "auto" }}
      />
    </span>
  );
}
