/** Text mark for the product sign-up page. The shared image wordmark stays on other pages. */
export function KaydenChiewMark({
  compact = false,
  height = 28,
}: {
  compact?: boolean;
  height?: number;
}) {
  if (compact) {
    return (
      <span
        className="inline-flex items-center justify-center text-[11px] font-semibold tracking-wide text-accent"
        style={{ height, width: height }}
        aria-label="KD"
      >
        KD
      </span>
    );
  }

  return (
    <span
      className="text-sm font-semibold tracking-wide text-foreground"
      style={{ lineHeight: `${height}px` }}
    >
      KD
    </span>
  );
}
