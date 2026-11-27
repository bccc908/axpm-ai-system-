import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductSignupsList } from "@/components/customers/product-signups-list";
import { getServerSession } from "@/lib/auth/api-session";
import { loadProductSignups } from "@/lib/customers/load-product-signups";
import { canViewProductSignups } from "@/lib/customers/product-signups";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients · KD",
  description: "KD client sign-ups",
  applicationName: "KD",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KD",
  },
  robots: { index: false, follow: false },
};

export default async function ClientsPage() {
  const ctx = await getServerSession();
  if (!ctx) redirect("/login");
  if (!canViewProductSignups(ctx.user.role)) redirect("/dashboard");

  const list = await loadProductSignups();
  return <ProductSignupsList list={list} />;
}
