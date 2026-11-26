import { LocaleProvider } from "@/components/providers/locale-provider";
import { publicMetadata } from "@/lib/brand/public-brand";

export const metadata = publicMetadata();

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider defaultLocale="zh" storageKey="kc-register-locale">
      {children}
    </LocaleProvider>
  );
}
