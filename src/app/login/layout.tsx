import type { Metadata, Viewport } from "next";
import { authDocumentTitle } from "@/components/auth/auth-document-title";
import { AuthQuietFrame } from "@/components/auth/auth-quiet-frame";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#05070B",
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: await authDocumentTitle({ en: "Staff sign in · KD", zh: "员工登录 · KD" }) };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthQuietFrame audience="staff">{children}</AuthQuietFrame>;
}
