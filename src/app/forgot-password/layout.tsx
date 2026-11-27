import type { Metadata, Viewport } from "next";
import { authDocumentTitle } from "@/components/auth/auth-document-title";
import { AuthQuietFrame } from "@/components/auth/auth-quiet-frame";
import { SIGNUP_LOCALE_STORAGE_KEY } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#05070B",
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await authDocumentTitle({ en: "Reset your password · KD", zh: "重置密码 · KD" }),
  };
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthQuietFrame audience="customer" storageKey={SIGNUP_LOCALE_STORAGE_KEY}>
      {children}
    </AuthQuietFrame>
  );
}
