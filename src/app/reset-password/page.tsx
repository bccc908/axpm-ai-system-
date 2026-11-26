import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/public-auth-forms";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { publicMetadata } from "@/lib/brand/public-brand";

export const metadata = publicMetadata();

export default function ResetPasswordPage() {
  return (
    <LocaleProvider storageKey="kc-locale">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </LocaleProvider>
  );
}
