import { LocaleProvider } from "@/components/providers/locale-provider";
import { REGISTER_LOCALE_STORAGE_KEY } from "@/lib/i18n";

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider defaultLocale="zh" storageKey={REGISTER_LOCALE_STORAGE_KEY}>
      {children}
    </LocaleProvider>
  );
}
