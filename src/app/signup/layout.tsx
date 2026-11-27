import type { Metadata } from "next";
import { headers } from "next/headers";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { SIGNUP_LOCALE_STORAGE_KEY, detectLocaleFromHeaders } from "@/lib/i18n";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const defaultLocale = detectLocaleFromHeaders(headerList);

  return (
    <LocaleProvider defaultLocale={defaultLocale} storageKey={SIGNUP_LOCALE_STORAGE_KEY}>
      {children}
    </LocaleProvider>
  );
}
