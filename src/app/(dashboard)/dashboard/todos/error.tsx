"use client";

export default function TodosError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-danger/30 bg-danger/5 p-6">
      <h2 className="text-lg font-semibold text-foreground">To-Do page failed to load</h2>
      <p className="text-sm text-muted">
        The dev cache is often corrupted. In Terminal run:
      </p>
      <pre className="rounded-lg bg-background p-3 text-sm">npm run dev:reset</pre>
      <p className="text-sm text-muted">Then hard refresh the browser (Cmd+Shift+R).</p>
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
