import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ZohoCrmHub } from "@/components/crm/zoho-crm-hub";

function CrmLoading() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted" />
    </div>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={<CrmLoading />}>
      <ZohoCrmHub />
    </Suspense>
  );
}
