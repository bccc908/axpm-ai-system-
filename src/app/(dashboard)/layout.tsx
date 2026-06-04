import { AppShell } from "@/components/layout/app-shell";
import { LocaleProvider } from "@/components/providers/locale-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <AppShell>{children}</AppShell>
    </LocaleProvider>
  );
}
