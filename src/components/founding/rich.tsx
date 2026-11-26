import type { Rich } from "@/lib/founding/copy";
import type { SellerKey } from "@/lib/founding/config";

export type SellerValues = Record<SellerKey, string | null>;

const PH_CLASS =
  "ph rounded border border-dashed border-amber-400/70 bg-amber-400/10 px-1 text-amber-300";

/** Unfilled placeholders render with class="ph" so the placeholder gate rejects the page. */
export function Placeholder({ children }: { children: string }) {
  return <span className={PH_CLASS}>{children}</span>;
}

export function RichText({ rich, seller, locale }: { rich: Rich; seller: SellerValues; locale: "en" | "zh" }) {
  return (
    <>
      {rich.map((seg, i) => {
        if (typeof seg === "string") return <span key={i}>{seg}</span>;
        if ("ph" in seg) {
          return <Placeholder key={i}>{locale === "zh" ? `【待定：${seg.ph}】` : `[TBD: ${seg.ph}]`}</Placeholder>;
        }
        if ("seller" in seg) {
          const v = seller[seg.seller];
          return v ? <span key={i}>{v}</span> : <Placeholder key={i}>{`{{${seg.seller}}}`}</Placeholder>;
        }
        const href = typeof seg.href === "string" ? seg.href : seller[seg.href.seller];
        if (!href) {
          const key = typeof seg.href === "string" ? "" : seg.href.seller;
          return <Placeholder key={i}>{`${seg.link} {{${key}}}`}</Placeholder>;
        }
        return (
          <a key={i} href={href} className="text-accent underline underline-offset-2" rel="noopener">
            {seg.link}
          </a>
        );
      })}
    </>
  );
}
