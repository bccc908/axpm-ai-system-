"use client";

export interface ZiweiPalaceView {
  branch: string;
  stars: string[];
}

const BRANCH_GRID: Array<{ branch: string; col: number; row: number }> = [
  { branch: "巳", col: 1, row: 1 },
  { branch: "午", col: 2, row: 1 },
  { branch: "未", col: 3, row: 1 },
  { branch: "申", col: 4, row: 1 },
  { branch: "辰", col: 1, row: 2 },
  { branch: "酉", col: 4, row: 2 },
  { branch: "卯", col: 1, row: 3 },
  { branch: "戌", col: 4, row: 3 },
  { branch: "寅", col: 1, row: 4 },
  { branch: "丑", col: 2, row: 4 },
  { branch: "子", col: 3, row: 4 },
  { branch: "亥", col: 4, row: 4 },
];

function PalaceCell({
  branch,
  stars,
  isMing,
  isShen,
}: {
  branch: string;
  stars: string[];
  isMing: boolean;
  isShen: boolean;
}) {
  return (
    <div
      className={`min-h-[54px] rounded-md border px-1.5 py-1 transition-colors ${
        isMing
          ? "border-amber-400/70 bg-amber-500/15 ring-1 ring-amber-400/40"
          : isShen
            ? "border-violet-400/50 bg-violet-500/10"
            : stars.length
              ? "border-card-border bg-background/70"
              : "border-card-border/60 bg-background/40"
      }`}
    >
      <div className="flex items-center justify-between gap-0.5">
        <span className="text-xs font-bold text-foreground">{branch}</span>
        {isMing ? (
          <span className="rounded bg-amber-500/20 px-1 text-[9px] font-semibold text-amber-700 dark:text-amber-200">
            命
          </span>
        ) : isShen ? (
          <span className="rounded bg-violet-500/20 px-1 text-[9px] font-semibold text-violet-700 dark:text-violet-200">
            身
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted">
        {stars.length ? stars.join(" ") : "—"}
      </p>
    </div>
  );
}

export function FortuneZiweiChart({
  palaces,
  mingBranch,
  shenBranch,
  centerTitle,
  centerSubtitle,
  trait,
}: {
  palaces: ZiweiPalaceView[];
  mingBranch: string;
  shenBranch: string;
  centerTitle: string;
  centerSubtitle: string;
  trait?: string;
}) {
  const starMap = Object.fromEntries(palaces.map((p) => [p.branch, p.stars]));

  return (
    <div className="space-y-2">
      <div className="relative grid grid-cols-4 grid-rows-4 gap-1 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-background to-indigo-500/5 p-1.5">
        {BRANCH_GRID.map(({ branch, col, row }) => (
          <div key={branch} style={{ gridColumn: col, gridRow: row }}>
            <PalaceCell
              branch={branch}
              stars={starMap[branch] ?? []}
              isMing={branch === mingBranch}
              isShen={branch === shenBranch}
            />
          </div>
        ))}
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-violet-400/20 bg-background/85 px-2 py-3 text-center shadow-sm"
          style={{ gridColumn: "2 / span 2", gridRow: "2 / span 2" }}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-violet-600 dark:text-violet-300">
            {centerSubtitle}
          </p>
          <p className="mt-1 text-sm font-bold leading-snug text-foreground">{centerTitle}</p>
        </div>
      </div>
      {trait ? <p className="text-xs text-muted">{trait}</p> : null}
    </div>
  );
}
