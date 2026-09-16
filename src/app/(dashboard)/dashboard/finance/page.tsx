import { Suspense } from "react";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";

export default function FinancePage() {
  return (
    <Suspense fallback={null}>
      <FinanceDashboard />
    </Suspense>
  );
}
