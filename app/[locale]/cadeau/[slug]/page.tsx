import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icone from "@/components/tj/Icone";
import { getTranslations } from "next-intl/server";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/structured-data";
import GiftDeadlineNote from "@/components/GiftDeadlineNote";
import { GIFT_PRODUCTS } from "@/lib/productFeed";
import { SITE_URL } from "@/lib/site";
import { locales, type Locale } from "@/i18n/config";
import {
  OCCASIONS,
  OCCASION_KEYS,
  allGiftSlugs,
  buildGiftSlug,
  parseGiftSlug,
} from "@/lib/giftOccasions";
import { alternatesPour } from "@/lib/seo";

export const revalidate = 86400;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    allGiftSlugs(locale).map((slug) => ({ locale, slug }))
  );
}

function resolve(localeRaw: string, slug: string) {
  if (!(locales as readonly string[]).includes(localeRaw)) return null;
  const locale = localeRaw as Locale;

  const parsed = parseGiftSlug(locale, slug);
  if (!parsed) return null;

  const product = GIFT_PRODUCTS.find((p) => p.slug === parsed.styleSlug);
  if (!product) return null;

  const occasion = OCCASIONS[locale][parsed.occasion];
  const styleName = product.translations[locale].title;

  return { locale, product, occasion, occasionKey: parsed.occasion, styleName };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: localeRaw, slug } = await params;
  const data = resolve(localeRaw, slug);
  if (!data) return {};

  const { locale, product, occasion, occasionKey, styleName } = data;
  const title = `${occasion.headline(styleName)} | Cartoonova`;

  return {
    title,
    description: occasion.intro.slice(0, 155),
    // Le slug differe d'une langue a l'autre : chaque alternance se calcule.
    alternates: alternatesPour(
      locale,
      Object.fromEntries(
        locales.map((l) => [l, `/cadeau/${buildGiftSlug(l, product.slug, occasionKey)}`])
      )
    ),
    openGraph: {
      title,
      description: occasion.intro.slice(0, 200),
      url: `${SITE_URL}/${locale}/cadeau/${slug}`,
      siteName: "Cartoonova",
      images: [{ url: `${SITE_URL}${product.image}`, width: 1200, height: 630, alt: styleName }],
      type: "website",
    },
  };
}

export default async function GiftOccasionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeRaw, slug } = await params;
  const data = resolve(localeRaw, slug);
  if (!data) notFound();

  const { locale, product, occasion, occasionKey, styleName } = data;
  const t = await getTranslations({ locale, namespace: "giftPage" });

  const stylePath = `/${locale}/${product.slug}`;
  const otherOccasions = OCCASION_KEYS.filter((key) => key !== occasionKey);
  const otherStyles = GIFT_PRODUCTS.filter((p) => p.slug !== product.slug);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbs={[
          { name: t("home"), item: `${SITE_URL}/${locale}` },
          { name: styleName, item: `${SITE_URL}${stylePath}` },
          { name: occasion.headline(styleName), item: `${SITE_URL}/${locale}/cadeau/${slug}` },
        ]}
      />
      <FAQJsonLd faq={occasion.faq} />

      <main className="page-tj">
        <div className="enveloppe">
          <nav aria-label="fil d'ariane" className="text-sm font-bold text-black/50 mb-6 flex flex-wrap gap-2">
            <Link href={`/${locale}`} className="hover:text-black transition-colors">{t("home")}</Link>
            <span aria-hidden="true">/</span>
            <span>{t("section")}</span>
            <span aria-hidden="true">/</span>
            <Link href={stylePath} className="hover:text-black transition-colors">{styleName}</Link>
          </nav>

          <header className="mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black leading-tight mb-5 text-balance">
              {occasion.headline(styleName)}
            </h1>
            <p style={{ color: "var(--encre-doux)", maxWidth: "56ch" }}>{occasion.intro}</p>
            <div className="mt-6">
              <GiftDeadlineNote />
            </div>
          </header>

          <div className="grid md:grid-cols-2 gap-8 items-start mb-12">
            <div style={{ position: "relative", aspectRatio: "4 / 5", borderRadius: "var(--rayon-lg)", overflow: "hidden", boxShadow: "var(--ombre)" }}>
              <Image
                src={product.image}
                alt={`${styleName} — ${occasion.label}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            <div>
              <h2 className="text-2xl font-black text-black mb-4">{t("whyTitle")}</h2>
              <ul className="flex flex-col gap-3 mb-6">
                {occasion.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-black/75 font-medium leading-relaxed">
                    <Icone nom="coche" taille={15} style={{ color: "var(--soleil-fonce)" }} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <p className="text-black/70 font-medium leading-relaxed">
                {product.translations[locale].description}
              </p>
            </div>
          </div>

          <section className="cta-cadeau">
            <h2 className="text-2xl sm:text-3xl font-black text-black mb-4">{t("ctaTitle")}</h2>
            <Link
              href={stylePath}
              className="bouton bouton--clair"
            >
              {t("ctaButton")}
            </Link>
            <p className="mt-4 text-sm font-bold text-black/60">{t("ctaNote")}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-black text-black mb-5">{t("faqTitle")}</h2>
            <div className="flex flex-col gap-4">
              {occasion.faq.map((item) => (
                <details key={item.question} className="bloc">
                  <summary className="font-black text-black cursor-pointer">{item.question}</summary>
                  <p className="mt-3 text-black/70 font-medium leading-relaxed">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="grid sm:grid-cols-2 gap-8">
            <div>
              <h2 className="text-sm font-black text-black/40 uppercase tracking-wider mb-3">{t("otherOccasions")}</h2>
              <ul className="flex flex-col gap-2">
                {otherOccasions.map((key) => (
                  <li key={key}>
                    <Link
                      href={`/${locale}/cadeau/${buildGiftSlug(locale, product.slug, key)}`}
                      className="font-bold text-black/70 hover:text-black underline decoration-amber-400 decoration-2 underline-offset-4"
                    >
                      {OCCASIONS[locale][key].headline(styleName)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-black text-black/40 uppercase tracking-wider mb-3">{t("otherStyles")}</h2>
              <ul className="flex flex-col gap-2">
                {otherStyles.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={`/${locale}/cadeau/${buildGiftSlug(locale, other.slug, occasionKey)}`}
                      className="font-bold text-black/70 hover:text-black underline decoration-amber-400 decoration-2 underline-offset-4"
                    >
                      {occasion.headline(other.translations[locale].title)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
