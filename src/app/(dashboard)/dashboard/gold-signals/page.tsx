import { Suspense } from "react";
import { CustomerGoldSignals } from "@/components/customer/customer-gold-signals";
import { GoldSignalsPanel } from "@/components/gold/gold-signals-panel";
import { getServerSession } from "@/lib/auth/api-session";

export default async function GoldSignalsPage() {
  const ctx = await getServerSession();
  if (ctx?.user.role === "customer") return <CustomerGoldSignals />;

  return (
    <div className="gold-desk flex min-w-0 flex-1 flex-col">
      <Suspense fallback={<div className="p-6 font-mono text-xs text-zinc-500">Loading desk…</div>}>
        <GoldSignalsPanel />
      </Suspense>
    </div>
  );
}
