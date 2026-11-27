import { headers } from "next/headers";
import { detectLocaleFromHeaders, type Locale } from "@/lib/i18n";

export async function authDocumentTitle(titles: Record<Locale, string>): Promise<string> {
  const locale = detectLocaleFromHeaders(await headers());
  return titles[locale];
}
