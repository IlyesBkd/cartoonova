import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getArticleBySlug, getRelatedArticles } from "@/lib/blogDb";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/structured-data";
import ArticleBody from "@/components/blog/ArticleBody";
import LectureArticle from "@/components/blog/LectureArticle";

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
    <main className="page-tj">
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

      <LectureArticle slug={article.slug} categorie={article.category} langue={locale} />

      <article className="enveloppe prose" style={{ paddingBlock: "clamp(40px,6vw,72px)" }}>
        <Link href={`/${locale}/blog`} className="inline-flex items-center gap-2 text-sm font-black text-black/50 hover:text-black transition-colors mb-6">
          ← {t("backToBlog")}
        </Link>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black leading-tight mb-4">{article.title}</h1>
        <p className="text-sm font-bold text-black/50 mb-8">{t("publishedOn")} {publishedDate}</p>

        {cover && (
          <div style={{ position: "relative", aspectRatio: "16 / 9", marginBottom: 34, borderRadius: "var(--rayon-lg)", overflow: "hidden", boxShadow: "var(--ombre)" }}>
            <Image src={cover.url} alt={cover.alt || article.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" priority />
          </div>
        )}

        <ArticleBody markdown={article.body} />

        {article.images.length > 1 && (
          <div className="grid sm:grid-cols-2 gap-4 mt-10">
            {article.images.slice(1).map((image, index) => (
              <div key={index} style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: "var(--rayon)", overflow: "hidden" }}>
                <Image src={image.url} alt={image.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 384px" />
              </div>
            ))}
          </div>
        )}
      </article>

      <section className="section" style={{ background: "var(--soleil)" }}>
        <div className="enveloppe" style={{ textAlign: "center" }}>
          <h2 className="text-2xl sm:text-3xl font-black text-black uppercase mb-3">{t("ctaTitle")}</h2>
          <p className="text-black/70 font-bold mb-6">{t("ctaSubtitle")}</p>
          <Link
            href={`/${locale}/collections`}
            className="bouton bouton--primaire"
          >
            {t("ctaButton")}
          </Link>
        </div>
      </section>

      {related.length > 0 && (
        <section className="enveloppe" style={{ paddingBlock: "clamp(38px,5vw,62px)" }}>
          <h2 className="text-2xl font-black text-black uppercase mb-6">{t("relatedArticles")}</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {related.map((item) => {
              const relatedCover = item.images[0];
              return (
                <Link
                  key={item.id}
                  href={`/${locale}/blog/${item.slug}`}
                  className="carte"
                >
                  {relatedCover && (
                    <div style={{ position: "relative", aspectRatio: "16 / 10", background: "var(--cendre)" }}>
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
