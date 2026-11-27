import { PUBLIC_BRAND, publicMetadata } from "@/lib/brand/public-brand";

export const metadata = publicMetadata();

export default function ClientDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-4 text-sm font-semibold tracking-wide text-foreground">{PUBLIC_BRAND}</p>
      {children}
    </div>
  );
}
