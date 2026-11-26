import type { Metadata } from "next";
import Link from "next/link";
import { COPY, FEATURES, type Locale } from "@/lib/founding/copy";
import { SELLER_KEYS, sellerValue, waitlistGate } from "@/lib/founding/config";
import { RichText, type SellerValues } from "@/components/founding/rich";
import { WaitlistForm } from "./waitlist-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: COPY.meta.title.en },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

function pickLocale(raw: string | string[] | undefined): Locale {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "zh" ? "zh" : "en";
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-card-border bg-card p-5 sm:p-7">
      {children}
    </section>
  );
}

export default async function FoundingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = pickLocale((await searchParams).lang);
  const gate = waitlistGate();
  const seller = Object.fromEntries(SELLER_KEYS.map((k) => [k, sellerValue(k)])) as SellerValues;
  const h2 = "text-xl font-semibold text-foreground sm:text-2xl";
  const body = "text-sm leading-relaxed text-foreground/90 sm:text-base";

  return (
    <div lang={locale === "zh" ? "zh-CN" : "en"} className="min-h-screen bg-background text-foreground">
      {!gate.open ? (
        <div role="note" data-testid="preview-banner" className="sticky top-0 z-10 border-b border-amber-400/50 bg-amber-950/90 px-4 py-2 text-center text-xs text-amber-100 sm:text-sm">
          {COPY.previewBanner[locale]}
        </div>
      ) : null}

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide text-foreground">Kayden Chiew</span>
          <nav className="flex gap-2 text-xs" aria-label="Language">
            <Link href="/founding?lang=en" className={`rounded-lg px-3 py-1.5 ${locale === "en" ? "bg-accent text-accent-foreground" : "border border-card-border text-muted"}`}>
              EN
            </Link>
            <Link href="/founding?lang=zh" className={`rounded-lg px-3 py-1.5 ${locale === "zh" ? "bg-accent text-accent-foreground" : "border border-card-border text-muted"}`}>
              中文
            </Link>
          </nav>
        </div>

        <header className="space-y-4 pt-2">
          <p className="text-xs font-medium uppercase tracking-widest text-accent">{COPY.hero.eyebrow[locale]}</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{COPY.hero.h1[locale]}</h1>
          <p className={body}>{COPY.hero.sub[locale]}</p>
          <p className="inline-block rounded-full border border-card-border bg-surface-2 px-3 py-1 text-xs text-muted">{COPY.hero.badge[locale]}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href="#waitlist" className="rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-foreground">
              {COPY.hero.primary[locale]}
            </a>
            <span className="rounded-lg border border-card-border px-4 py-2.5 text-center text-sm text-muted">
              <RichText rich={COPY.hero.secondary[locale]} seller={seller} locale={locale} />
            </span>
          </div>
        </header>

        <Section>
          <h2 className={h2}>{COPY.problem.h2[locale]}</h2>
          <p className={`${body} mt-3`}>
            <RichText rich={COPY.problem.body[locale]} seller={seller} locale={locale} />
          </p>
        </Section>

        <Section>
          <h2 className={h2}>{COPY.features.h2[locale]}</h2>
          <ul className="mt-4 space-y-2">
            {FEATURES.map((f, i) => (
              <li key={i} className={body}>
                • {f.text[locale]}
                {f.footnote ? <sup>*</sup> : null}
                {f.planned ? (
                  <span className="ml-2 text-xs text-muted">
                    <RichText rich={COPY.features.plannedLabel[locale]} seller={seller} locale={locale} />
                  </span>
                ) : null}
                {i === 5 ? (
                  <span className="ml-2 text-xs">
                    <RichText rich={COPY.features.rolesNote[locale]} seller={seller} locale={locale} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">* {COPY.features.footnote[locale]}</p>
          <p className="mt-2 text-xs text-muted">{COPY.features.scope[locale]}</p>
        </Section>

        <Section>
          <h2 className={h2}>{COPY.who.h2[locale]}</h2>
          <dl className={`${body} mt-3 space-y-2`}>
            <div><dt className="inline font-semibold">{COPY.who.forLabel[locale]}: </dt><dd className="inline">{COPY.who.for[locale]}</dd></div>
            <div><dt className="inline font-semibold">{COPY.who.marketsLabel[locale]}: </dt><dd className="inline"><RichText rich={COPY.who.markets[locale]} seller={seller} locale={locale} /></dd></div>
            <div><dt className="inline font-semibold">{COPY.who.notForLabel[locale]}: </dt><dd className="inline">{COPY.who.notFor[locale]}</dd></div>
          </dl>
        </Section>

        <Section>
          <h2 className={h2}>{COPY.offer.h2[locale]}</h2>
          <ul className="mt-3 space-y-2">
            {COPY.offer.lines[locale].map((line, i) => (
              <li key={i} className={body}>• <RichText rich={line} seller={seller} locale={locale} /></li>
            ))}
          </ul>
          <h3 className="mt-6 text-lg font-semibold">{COPY.partners.h3[locale]}</h3>
          <ul className="mt-3 space-y-2">
            {COPY.partners.lines[locale].map((line, i) => (
              <li key={i} className={body}>• <RichText rich={line} seller={seller} locale={locale} /></li>
            ))}
          </ul>
        </Section>

        <Section id="join">
          <h2 className={`${h2} mb-4`}>{COPY.form.h2[locale]}</h2>
          <WaitlistForm locale={locale} collectionOpen={gate.open} seller={seller} />
        </Section>

        <Section>
          <h2 className={h2}>{COPY.cta.h2[locale]}</h2>
          <p className={`${body} mt-2`}>{COPY.cta.body[locale]}</p>
          <a href="#waitlist" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">
            {COPY.cta.button[locale]}
          </a>
        </Section>

        <Section>
          <h2 className={h2}>{COPY.faq.h2[locale]}</h2>
          <div className="mt-3 divide-y divide-card-border">
            {COPY.faq.items[locale].map((item, i) => (
              <details key={i} className="py-3" open>
                <summary className="cursor-pointer text-sm font-semibold sm:text-base">{item.q}</summary>
                <p className={`${body} mt-2`}>
                  <RichText rich={item.a} seller={seller} locale={locale} />
                </p>
              </details>
            ))}
          </div>
        </Section>

        <footer className="pb-8 pt-2 text-center text-xs text-muted">
          <RichText rich={COPY.footer[locale]} seller={seller} locale={locale} />
        </footer>
      </main>
    </div>
  );
}
