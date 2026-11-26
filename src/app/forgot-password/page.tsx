import { ForgotPasswordForm } from "@/components/auth/public-auth-forms";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { publicMetadata } from "@/lib/brand/public-brand";

export const metadata = publicMetadata();

export default function ForgotPasswordPage() {
  return (
    <LocaleProvider storageKey="kc-locale">
      <ForgotPasswordForm />
    </LocaleProvider>
  );
}
