import { Suspense } from "react";
import { GoldSignalsPanel } from "@/components/gold/gold-signals-panel";

export default function GoldSignalsPage() {
  return (
    <div className="gold-desk flex min-w-0 flex-1 flex-col">
      <Suspense fallback={<div className="p-6 font-mono text-xs text-zinc-500">Loading desk…</div>}>
        <GoldSignalsPanel />
      </Suspense>
    </div>
  );
}
