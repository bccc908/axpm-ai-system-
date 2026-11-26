import { headers } from "next/headers";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { detectLocaleFromHeaders } from "@/lib/i18n";
import { publicMetadata } from "@/lib/brand/public-brand";

export const metadata = publicMetadata();

export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const defaultLocale = detectLocaleFromHeaders(headerList);

  return (
    <LocaleProvider defaultLocale={defaultLocale} storageKey="kc-signup-locale">
      {children}
    </LocaleProvider>
  );
}
