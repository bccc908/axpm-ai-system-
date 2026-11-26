import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/components/providers/auth-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { getServerSession } from "@/lib/auth/api-session";
import { PUBLIC_SIGNUP_ROLE } from "@/lib/auth/types";
import { isEmailVerified } from "@/lib/auth/verification";
import { publicMetadata } from "@/lib/brand/public-brand";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getServerSession();
  if (!ctx || ctx.user.role === PUBLIC_SIGNUP_ROLE) return publicMetadata();
  return {
    title: "AXPM",
    applicationName: "AXPM",
    description: "AXPM — CRM、财务、收件箱与 AI 助手",
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getServerSession();
  if (ctx && !isEmailVerified(ctx.user)) {
    redirect("/verify-email");
  }
  const role = ctx?.user.role ?? null;

  return (
    <LocaleProvider storageKey={role === PUBLIC_SIGNUP_ROLE ? "kc-locale" : undefined}>
      <AuthProvider>
        <AppShell sessionRole={role}>{children}</AppShell>
      </AuthProvider>
    </LocaleProvider>
  );
}
