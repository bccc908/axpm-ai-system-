"use client";

import { useEffect } from "react";

export default function AiAssistantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Reply Agent]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-danger/30 bg-danger/5 p-6">
      <h2 className="text-lg font-semibold text-foreground">Reply Agent failed to load</h2>
      <p className="text-sm text-muted">Run in terminal:</p>
      <pre className="rounded-lg bg-background p-3 text-sm">npm run dev:reset</pre>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
