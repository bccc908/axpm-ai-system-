import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/components/providers/auth-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <AuthProvider>
        <AppShell>{children}</AppShell>
      </AuthProvider>
    </LocaleProvider>
  );
}
