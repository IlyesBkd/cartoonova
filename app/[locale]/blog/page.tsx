import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getPublishedArticles } from "@/lib/blogDb";
import { SITE_URL } from "@/lib/site";
import { alternatesPour } from "@/lib/seo";

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
      ...alternatesPour(locale, "/blog"),
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
    <>
      <section className="entete-page">
        <div className="enveloppe">
          <h1>
            {t("title")}
          </h1>
          <p>
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="enveloppe">
          {articles.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--encre-doux)", padding: "60px 0" }}>{t("noArticles")}</p>
          ) : (
            <div className="styles-grille">
              {articles.map((article) => {
                const cover = article.images[0];
                return (
                  <Link
                    key={article.id}
                    href={`/${locale}/blog/${article.slug}`}
                    className="carte"
                  >
                    {cover && (
                      <div style={{ position: "relative", aspectRatio: "16 / 10", background: "var(--cendre)" }}>
                        <Image
                          src={cover.url}
                          alt={cover.alt || article.title}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="carte__corps">
                      <h3>{article.title}</h3>
                      <p>{article.excerpt}</p>
                      <span className="carte__prix">
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
    </>
  );
}
