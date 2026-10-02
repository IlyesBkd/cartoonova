import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { articleEnCache, articlesLiesEnCache, articlesPubliesEnCache, refsArticlesEnCache } from "@/lib/lecturesCache";
import { liensPourArticle } from "@/lib/maillage";
import LiensProduits from "@/components/blog/LiensProduits";
import type { Locale } from "@/i18n/config";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/structured-data";
import ArticleBody from "@/components/blog/ArticleBody";
import { IMAGE_PARTAGE, OG_LOCALE, couper, titreSeo } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import LectureArticle from "@/components/blog/LectureArticle";

export const revalidate = 300;

/* Les 30 articles les plus recents de chaque langue sont construits au
   deploiement ; les plus anciens a leur premiere visite, puis servis par le
   CDN. Sans cette pre-generation, le premier visiteur d'un article — souvent
   Googlebot — attendait jusqu'a 18 s. Une base injoignable pendant le build ne
   le fait pas echouer : on retombe sur la generation a la demande. */
export async function generateStaticParams() {
  const { locales } = await import("@/i18n/config");
  const listes = await Promise.all(
    locales.map((locale) =>
      articlesPubliesEnCache(locale, 30)
        .then((articles) => articles.map((a) => ({ locale, slug: a.slug })))
        .catch(() => [])
    )
  );
  return listes.flat();
}

const baseUrl = SITE_URL;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await articleEnCache(locale, slug);
  if (!article) return {};

  const url = `${baseUrl}/${locale}/blog/${article.slug}`;
  const cover = article.images[0];
  // Titre et description viennent de la base, rediges par le moteur : sans
  // garde-fou de longueur, Google les coupait.
  const titre = titreSeo(article.seo.title);
  const description = couper(article.seo.description);
  /* Les traductions d'un meme article partagent son sujet (topicId) : on les
     annonce en hreflang, comme les autres pages du site. */
  const refs = await refsArticlesEnCache().catch(() => []);
  const sujet = refs.find((r) => r.locale === locale && r.slug === article.slug)?.topicId;
  const traductions = sujet ? refs.filter((r) => r.topicId === sujet) : [];
  const languages: Record<string, string> = Object.fromEntries(
    traductions.map((r) => [r.locale, `${baseUrl}/${r.locale}/blog/${r.slug}`])
  );

  return {
    title: titre,
    description,
    alternates: { canonical: url, ...(traductions.length > 1 ? { languages } : {}) },
    openGraph: {
      title: titre,
      description,
      url,
      siteName: "Cartoonova",
      locale: OG_LOCALE[locale as Locale] ?? OG_LOCALE.fr,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: cover ? [{ url: cover.url, width: cover.width, height: cover.height, alt: cover.alt }] : [{ url: IMAGE_PARTAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: titre,
      description,
      images: [cover?.url ?? IMAGE_PARTAGE],
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const article = await articleEnCache(locale, slug);
  if (!article) notFound();

  /* Les fiches a relier depuis cet article. Le blog ne pointait vers aucune
     page de vente, et les fiches que Google n'a jamais explorees n'avaient
     aucun chemin qui y mene — `liensPourArticle` traite les deux. */
  const [t, related, fiches] = await Promise.all([
    getTranslations({ locale, namespace: "blog" }),
    articlesLiesEnCache(locale, article.category, article.id, 3),
    liensPourArticle(locale as Locale, article.title, article.seo?.keywords ?? []),
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
          { name: "Cartoonova", item: `${baseUrl}/${locale}` },
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
          /* Rail horizontal sur mobile (voir pages.css) : empilees, ces images
             ajoutaient un ecran chacune sous l'article. */
          <div className="article-images mt-10">
            {article.images.slice(1).map((image, index) => (
              <div key={index} style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: "var(--rayon)", overflow: "hidden" }}>
                <Image src={image.url} alt={image.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 384px" />
              </div>
            ))}
          </div>
        )}
      </article>

      <LiensProduits
        locale={locale}
        titre={t("productLinks")}
        fiches={fiches}
        slugArticle={article.slug}
      />

      {/* Le bandeau jaune ne s'affiche que s'il n'y a aucune fiche liee : sinon
          les cartes juste au-dessus sont deja l'appel a l'action, et le bandeau
          en faisait un second, un ecran plus bas. */}
      {fiches.length === 0 && (
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
      )}

      {related.length > 0 && (
        <section className="enveloppe" style={{ paddingBlock: "clamp(38px,5vw,62px)" }}>
          <h2 className="text-2xl font-black text-black uppercase mb-6">{t("relatedArticles")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
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
