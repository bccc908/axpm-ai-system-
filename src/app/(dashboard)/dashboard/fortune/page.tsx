import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CustomerFortune } from "@/components/customer/customer-fortune";
import { FortuneTeller } from "@/components/fortune/fortune-teller";
import { getServerSession } from "@/lib/auth/api-session";

export default async function FortunePage() {
  const ctx = await getServerSession();
  if (ctx?.user.role === "customer") return <CustomerFortune />;

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
