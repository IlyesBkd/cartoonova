import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GIFT_PRODUCTS } from "@/lib/productFeed";
import { SITE_URL } from "@/lib/site";
import { locales, type Locale } from "@/i18n/config";
import { OCCASIONS, OCCASION_KEYS, buildGiftSlug } from "@/lib/giftOccasions";
import { alternatesPour } from "@/lib/seo";

export const revalidate = 86400;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeRaw } = await params;
  if (!(locales as readonly string[]).includes(localeRaw)) return {};
  const locale = localeRaw as Locale;
  const t = await getTranslations({ locale, namespace: "giftPage" });

  return {
    title: `${t("section")} | Cartoonova`,
    alternates: alternatesPour(locale, "/cadeau"),
  };
}

export default async function GiftIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  if (!(locales as readonly string[]).includes(localeRaw)) notFound();
  const locale = localeRaw as Locale;
  const t = await getTranslations({ locale, namespace: "giftPage" });

  return (
    <main className="page-tj">
      <div className="enveloppe">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black mb-10">{t("section")}</h1>

        <div className="flex flex-col gap-10">
          {OCCASION_KEYS.map((key) => {
            const occasion = OCCASIONS[locale][key];
            return (
              <section key={key}>
                <h2 style={{ fontFamily: "var(--titre)", fontSize: 21, borderBottom: "1px solid var(--encre-voile)", paddingBottom: 8, marginBottom: 16 }}>
                  {occasion.label}
                </h2>
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {GIFT_PRODUCTS.map((product) => (
                    <li key={product.slug}>
                      <Link
                        href={`/${locale}/cadeau/${buildGiftSlug(locale, product.slug, key)}`}
                        className="bloc" style={{ display: "block", textDecoration: "none", padding: "13px 18px" }}
                      >
                        {occasion.headline(product.translations[locale].title)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
