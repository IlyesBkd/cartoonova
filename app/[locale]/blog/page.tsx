import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getPublishedArticles } from "@/lib/blogDb";
import { SITE_URL } from "@/lib/site";

export const revalidate = 300;

const baseUrl = SITE_URL;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/blog`,
      types: {
        "application/rss+xml": [
          { url: `${baseUrl}/${locale}/blog/rss.xml`, title: t("metaTitle") },
        ],
      },
    },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: `${baseUrl}/${locale}/blog`,
      siteName: "Cartoonova",
      type: "website",
    },
  };
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, articles] = await Promise.all([
    getTranslations({ locale, namespace: "blog" }),
    getPublishedArticles(locale, 24),
  ]);

  return (
    <main className="min-h-screen pt-20 bg-white">
      <section className="bg-yellow-400 py-16 sm:py-20 border-b-4 border-black relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-black uppercase leading-tight">
            {t("title")}
          </h1>
          <p className="mt-5 text-lg sm:text-xl font-bold text-black/70 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {articles.length === 0 ? (
            <p className="text-center text-black/60 font-bold text-lg py-16">{t("noArticles")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => {
                const cover = article.images[0];
                return (
                  <Link
                    key={article.id}
                    href={`/${locale}/blog/${article.slug}`}
                    className="group block bg-white border-4 border-black rounded-2xl overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
                  >
                    {cover && (
                      <div className="relative aspect-[16/10] bg-yellow-100">
                        <Image
                          src={cover.url}
                          alt={cover.alt || article.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <h2 className="font-black text-lg leading-snug text-black mb-2 line-clamp-2">{article.title}</h2>
                      <p className="text-sm text-black/60 font-semibold line-clamp-3 mb-3">{article.excerpt}</p>
                      <span className="inline-block text-xs font-black uppercase text-black/50 group-hover:text-black transition-colors">
                        {t("readMore")} →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
