import { MarketAiTwin } from "@/components/ai/market-ai-twin";
import { CustomerMarketAi } from "@/components/customer/customer-market-ai";
import { getServerSession } from "@/lib/auth/api-session";

export default async function MarketAiPage() {
  const ctx = await getServerSession();
  if (ctx?.user.role === "customer") return <CustomerMarketAi />;

  return (
    <div className="space-y-6">
      <MarketAiTwin />
    </div>
  );
}
