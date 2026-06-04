import { Loader2 } from "lucide-react";

export default function FinanceLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted">
      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
      Loading finance…
    </div>
  );
}
