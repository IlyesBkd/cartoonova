import { MetadataRoute } from "next";
import { locales, type Locale } from "@/i18n/config";
import { getAllPublishedArticleRefs } from "@/lib/blogDb";
import { SITE_URL } from "@/lib/site";
import { OCCASION_KEYS, buildGiftSlug } from "@/lib/giftOccasions";
import { GIFT_PRODUCTS } from "@/lib/productFeed";
import { CATALOGUE_EN_LIGNE, SLUG_PHARE } from "@/lib/catalogue";

const baseUrl = SITE_URL;

/* Horodatage fige au chargement du module, donc une fois par deploiement.
   Auparavant chaque entree portait `new Date()`, reevalue a chaque requete :
   les 405 URL se declaraient modifiees a la seconde ou Google lisait le
   fichier. Un `lastmod` qui bouge sans que rien ne change n'est pas une
   information, et Google finit par cesser d'y croire. */
const DERNIERE_PUBLICATION = new Date();

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface PageDef {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  /** Langues concernees. Les pages legales ne sont indexables qu'en francais
   *  tant que leur corps n'est pas traduit (voir `lib/seo.ts`). */
  locales?: readonly Locale[];
}

const pages: PageDef[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.95 },
  // Les fiches produit viennent du catalogue, plus bas.
  // Non traduite : indexable en francais seulement, comme les pages legales.
  { path: "/portrait-personnalise-cartoon", changeFrequency: "weekly", priority: 0.85, locales: ["fr"] },
  { path: "/blog", changeFrequency: "daily", priority: 0.8 },
  { path: "/cadeau", changeFrequency: "monthly", priority: 0.8 },
  { path: "/portfolio", changeFrequency: "monthly", priority: 0.7 },
  { path: "/avis", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/a-propos", changeFrequency: "yearly", priority: 0.4 },
  { path: "/cgv", changeFrequency: "yearly", priority: 0.3, locales: ["fr"] },
  { path: "/mentions-legales", changeFrequency: "yearly", priority: 0.3, locales: ["fr"] },
  { path: "/politique-de-confidentialite", changeFrequency: "yearly", priority: 0.3, locales: ["fr"] },
];

/** Bloc `alternates` d'une entree, quand le chemin est le meme partout. */
function alternatesUniformes(path: string) {
  return {
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `${baseUrl}/${l}${path}`])),
      "x-default": `${baseUrl}/en${path}`,
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    const languesDeLaPage = page.locales ?? locales;
    for (const locale of languesDeLaPage) {
      entries.push({
        url: `${baseUrl}/${locale}${page.path}`,
        lastModified: DERNIERE_PUBLICATION,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        // Une page mono-langue n'a pas d'alternative a declarer.
        ...(languesDeLaPage.length > 1 ? { alternates: alternatesUniformes(page.path) } : {}),
      });
    }
  }

  /* Fiches produit — les styles du catalogue, dans les cinq langues.
     Le produit phare monte a 1 : les fiches partageaient la meme priorite,
     alors que l'une d'elles est attendue a 70 % des ventes. La priorite ne
     classe pas dans Google, mais elle oriente le budget d'exploration entre
     nos propres URL — autant qu'il aille la. */
  for (const produit of CATALOGUE_EN_LIGNE) {
    for (const locale of locales) {
      entries.push({
        url: `${baseUrl}/${locale}/${produit.slug}`,
        lastModified: DERNIERE_PUBLICATION,
        changeFrequency: "weekly",
        priority: produit.slug === SLUG_PHARE ? 1 : 0.9,
        alternates: alternatesUniformes(`/${produit.slug}`),
      });
    }
  }

  /* Pages « un style pour une occasion ». Leur slug est propre a la langue
     (« simpson-anniversaire », « simpson-geburtstag ») : les alternances se
     construisent style par style, pas par recopie du chemin. */
  for (const produit of GIFT_PRODUCTS) {
    for (const occasion of OCCASION_KEYS) {
      const parLangue = Object.fromEntries(
        locales.map((l) => [l, `${baseUrl}/${l}/cadeau/${buildGiftSlug(l, produit.slug, occasion)}`])
      ) as Record<Locale, string>;

      for (const locale of locales) {
        entries.push({
          url: parLangue[locale],
          lastModified: DERNIERE_PUBLICATION,
          changeFrequency: "monthly",
          priority: 0.7,
          alternates: { languages: { ...parLangue, "x-default": parLangue.en } },
        });
      }
    }
  }

  /* Articles de blog. Pas d'`alternates` : la table `articles` ne porte aucune
     cle de groupe de traduction, donc rien ne permet d'affirmer que l'article
     allemand est la version de l'article francais. Declarer un hreflang faux
     serait pire que de n'en declarer aucun — a rouvrir quand le schema portera
     un identifiant de groupe. */
  const articles = await getAllPublishedArticleRefs().catch(() => []);
  for (const article of articles) {
    entries.push({
      url: `${baseUrl}/${article.locale}/blog/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}

/* Note d'architecture — sitemap index.
   Le cahier des charges demande un index plus des sitemaps par langue et par
   type. A 405 URL, ca n'apporte rien : la limite de Google est de 50 000 URL
   par fichier. Le decoupage devient utile quand le catalogue programmatique
   et les 20 langues feront passer le site a plusieurs milliers d'URL — il se
   fera alors avec `generateSitemaps`. Reporte volontairement, pas oublie. */
