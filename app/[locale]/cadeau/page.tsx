import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FEED_PRODUCTS } from "@/lib/productFeed";
import { SITE_URL } from "@/lib/site";
import { locales, type Locale } from "@/i18n/config";
import { OCCASIONS, OCCASION_KEYS, buildGiftSlug } from "@/lib/giftOccasions";

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
    alternates: {
      canonical: `/${locale}/cadeau`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/cadeau`])),
    },
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
    <main className="min-h-screen bg-amber-50 pt-24 sm:pt-28 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black mb-10">{t("section")}</h1>

        <div className="flex flex-col gap-10">
          {OCCASION_KEYS.map((key) => {
            const occasion = OCCASIONS[locale][key];
            return (
              <section key={key}>
                <h2 className="text-xl font-black text-black border-b-2 border-black pb-2 mb-4 capitalize">
                  {occasion.label}
                </h2>
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {FEED_PRODUCTS.map((product) => (
                    <li key={product.slug}>
                      <Link
                        href={`/${locale}/cadeau/${buildGiftSlug(locale, product.slug, key)}`}
                        className="block bg-white border-2 border-black rounded-xl px-4 py-3 font-bold text-black/80 hover:text-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all"
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
