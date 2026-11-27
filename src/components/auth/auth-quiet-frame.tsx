import { headers } from "next/headers";
import { AuthMarketProvider, type AuthMarketValue } from "@/components/auth/auth-market";
import { QuietSignalShell } from "@/components/auth/auth-chrome";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { authMarketFromCountry, showGoogleSignIn, type AuthAudience } from "@/lib/auth/google-policy";
import { countryFromHeaders, localeFromCountry, LOCALE_STORAGE_KEY } from "@/lib/i18n";

export async function AuthQuietFrame({
  children,
  audience,
  storageKey = LOCALE_STORAGE_KEY,
}: {
  children: React.ReactNode;
  audience: AuthAudience;
  storageKey?: string;
}) {
  const headerList = await headers();
  const country = countryFromHeaders(headerList);
  const market = authMarketFromCountry(country);
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecretConfigured = Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());
  const googleClientId = showGoogleSignIn({
    audience,
    country,
    clientId,
    clientSecretConfigured,
  })
    ? clientId
    : null;

  const value: AuthMarketValue = { audience, market, googleClientId };

  return (
    <LocaleProvider defaultLocale={localeFromCountry(country)} storageKey={storageKey}>
      <AuthMarketProvider value={value}>
        <QuietSignalShell market={market}>{children}</QuietSignalShell>
      </AuthMarketProvider>
    </LocaleProvider>
  );
}
