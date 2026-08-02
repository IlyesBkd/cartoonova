import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getArticleBySlug, getRelatedArticles } from "@/lib/blogDb";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/structured-data";
import ArticleBody from "@/components/blog/ArticleBody";

export const revalidate = 300;

const baseUrl = "https://www.cartoonova.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getArticleBySlug(locale, slug);
  if (!article) return {};

  const url = `${baseUrl}/${locale}/blog/${article.slug}`;
  const cover = article.images[0];

  return {
    title: article.seo.title,
    description: article.seo.description,
    alternates: { canonical: url },
    openGraph: {
      title: article.seo.title,
      description: article.seo.description,
      url,
      siteName: "Cartoonova",
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: cover ? [{ url: cover.url, width: cover.width, height: cover.height, alt: cover.alt }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.seo.title,
      description: article.seo.description,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const article = await getArticleBySlug(locale, slug);
  if (!article) notFound();

  const [t, related] = await Promise.all([
    getTranslations({ locale, namespace: "blog" }),
    getRelatedArticles(locale, article.category, article.id, 3),
  ]);

  const url = `${baseUrl}/${locale}/blog/${article.slug}`;
  const cover = article.images[0];
  const publishedDate = new Date(article.publishedAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });

  return (
    <main className="min-h-screen pt-20 bg-white">
      <ArticleJsonLd
        article={{
          headline: article.title,
          description: article.excerpt,
          image: cover?.url ?? `${baseUrl}/favicon_io/apple-touch-icon.png`,
          url,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt,
        }}
      />
      <BreadcrumbJsonLd
        breadcrumbs={[
          { name: "Cartoonova", item: baseUrl },
          { name: t("title"), item: `${baseUrl}/${locale}/blog` },
          { name: article.title, item: url },
        ]}
      />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Link href={`/${locale}/blog`} className="inline-flex items-center gap-2 text-sm font-black text-black/50 hover:text-black transition-colors mb-6">
          ← {t("backToBlog")}
        </Link>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black leading-tight mb-4">{article.title}</h1>
        <p className="text-sm font-bold text-black/50 mb-8">{t("publishedOn")} {publishedDate}</p>

        {cover && (
          <div className="relative aspect-[16/9] mb-10 rounded-2xl overflow-hidden border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <Image src={cover.url} alt={cover.alt || article.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" priority />
          </div>
        )}

        <ArticleBody markdown={article.body} />

        {article.images.length > 1 && (
          <div className="grid sm:grid-cols-2 gap-4 mt-10">
            {article.images.slice(1).map((image, index) => (
              <div key={index} className="relative aspect-[4/3] rounded-xl overflow-hidden border-4 border-black">
                <Image src={image.url} alt={image.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 384px" />
              </div>
            ))}
          </div>
        )}
      </article>

      <section className="bg-yellow-400 border-y-4 border-black py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-black uppercase mb-3">{t("ctaTitle")}</h2>
          <p className="text-black/70 font-bold mb-6">{t("ctaSubtitle")}</p>
          <Link
            href={`/${locale}/collections`}
            className="inline-block bg-black text-yellow-400 font-black uppercase px-8 py-4 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            {t("ctaButton")}
          </Link>
        </div>
      </section>

      {related.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-2xl font-black text-black uppercase mb-6">{t("relatedArticles")}</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {related.map((item) => {
              const relatedCover = item.images[0];
              return (
                <Link
                  key={item.id}
                  href={`/${locale}/blog/${item.slug}`}
                  className="group block bg-white border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  {relatedCover && (
                    <div className="relative aspect-[16/10] bg-yellow-100">
                      <Image src={relatedCover.url} alt={relatedCover.alt || item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, 33vw" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-black text-base leading-snug text-black line-clamp-2">{item.title}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
