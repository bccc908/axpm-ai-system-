"use client";

import { useEffect } from "react";

export default function FinanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Finance page]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-danger/30 bg-danger/5 p-6">
      <h2 className="text-lg font-semibold text-foreground">Finance page failed to load</h2>
      <p className="text-sm text-muted">
        This often happens when the dev cache is stale. In the project folder run:
      </p>
      <pre className="rounded-lg bg-background p-3 text-sm">npm run dev:reset</pre>
      <p className="text-sm text-muted">Then refresh the browser and open Finance again.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
