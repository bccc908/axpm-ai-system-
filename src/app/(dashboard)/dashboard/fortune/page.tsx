import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { FortuneTeller } from "@/components/fortune/fortune-teller";

export default function FortunePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <FortuneTeller />
    </Suspense>
  );
}
