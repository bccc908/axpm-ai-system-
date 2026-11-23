import { redirect } from "next/navigation";
import { SolanaBotDesk } from "@/components/solana-bot/solana-bot-desk";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";

export const metadata = {
  title: "AXPM // SOLANA BOT",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Owner/admin watch page. Sample figures only — no execution path. */
export default async function SolanaBotPage() {
  const ctx = await getServerSession();
  if (!ctx || !roleCanAccessModule(ctx.user.role, "solana")) {
    redirect("/dashboard");
  }

  return <SolanaBotDesk serverAllowed />;
}
