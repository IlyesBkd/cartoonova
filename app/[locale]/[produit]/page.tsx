import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";
import {
  CATALOGUE_EN_LIGNE,
  NOMS_CATEGORIE,
  descriptionProduit,
  produitParSlug,
  produitsSimilaires,
  slugProduit,
  slugsProduit,
  titreProduit,
  universProduit,
} from "@/lib/catalogue";
import { getTranslations } from "next-intl/server";
import { visuelsProduit } from "@/lib/visuels";
import { getPricesForCurrency } from "@/lib/db";
import { PRINT_KEYS } from "@/lib/pricing";
import { DEFAULT_PRICE_SET } from "@/lib/types";
import FicheProduit, { type DonneesFiche } from "./FicheProduit";
import { OG_LOCALE, alternatesPour } from "@/lib/seo";

/* Route produit unique. Les six univers historiques gardent leur slug
   (/simpson, /dbz, /disney, /ghibli, /onepiece, /rickandmorty) : les
   campagnes et les liens indexes continuent de tomber au bon endroit. */

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    CATALOGUE_EN_LIGNE.map((p) => ({ locale, produit: slugProduit(p, locale) }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; produit: string }>;
}): Promise<Metadata> {
  const { locale: brut, produit: slug } = await params;
  const locale = brut as Locale;
  const p = produitParSlug(slug, locale);
  if (!p) return {};

  const titre = titreProduit(p, locale);
  const description = descriptionProduit(p, locale);
  const image = visuelsProduit(p.slug).galerie[0];
  const slugs = slugsProduit(p);

  return {
    title: `${titre} — Cartoonova`,
    description,
    // Chaque langue a son propre slug : les alternances se lisent dans la
    // table, elles ne se deduisent pas du chemin courant.
    alternates: alternatesPour(
      locale,
      Object.fromEntries(locales.map((l) => [l, `/${slugs[l]}`]))
    ),
    openGraph: {
      title: titre,
      description,
      url: `${SITE_URL}/${locale}/${slugs[locale]}`,
      siteName: "Cartoonova",
      locale: OG_LOCALE[locale] ?? OG_LOCALE.fr,
      type: "website",
      images: image ? [{ url: `${SITE_URL}${image}` }] : undefined,
    },
    /* Sans ce bloc, la carte Twitter du layout est heritee telle quelle : les
       35 fiches partageaient un titre generique unique. */
    twitter: {
      card: "summary_large_image",
      title: titre,
      description,
      images: image ? [`${SITE_URL}${image}`] : undefined,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; produit: string }>;
}) {
  const { locale: brut, produit: slug } = await params;
  const locale = brut as Locale;

  const p = produitParSlug(slug, locale);
  if (!p) notFound();

  /* Le slug francais reste reconnu dans toutes les langues, mais il n'y est
     plus l'adresse : /en/portrait-naruto-personnalise part en 308 vers
     /en/custom-naruto-portrait. Sans cette redirection, la fiche repondrait
     sur deux URL et Google devrait choisir. */
  const slugAttendu = slugProduit(p, locale);
  if (slug !== slugAttendu) permanentRedirect(`/${locale}/${slugAttendu}`);

  const visuels = visuelsProduit(p.slug);
  const tNav = await getTranslations({ locale, namespace: "nav" });

  /* Grille tarifaire, pour la fourchette du balisage Product. */
  let prix = DEFAULT_PRICE_SET;
  try {
    prix = await getPricesForCurrency("EUR");
  } catch {
    // Repli : la fiche reste servie meme si la base est injoignable.
  }

  const donnees: DonneesFiche = {
    slug: p.slug,
    idProduit: p.idProduit,
    univers: universProduit(p, locale),
    titre: titreProduit(p, locale),
    description: descriptionProduit(p, locale),
    categorieNom: NOMS_CATEGORIE[p.categorie][locale],
    categorieCle: p.categorie,
    personnages: p.personnages,
    galerie: visuels.galerie,
    legendes: visuels.legendes,
    decors: visuels.decors,
    supports: visuels.supports,
    similaires: produitsSimilaires(p).map((s) => ({
      // Le lien porte le slug de la langue courante ; le visuel se lit
      // toujours sous le slug canonique, qui nomme le dossier dans public/.
      slug: slugProduit(s, locale),
      univers: universProduit(s, locale),
      visuel: visuelsProduit(s.slug).galerie[0] ?? null,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Product",
                name: donnees.titre,
                description: donnees.description,
                brand: { "@type": "Brand", name: "Cartoonova" },
                image: visuels.galerie.map((v) => `${SITE_URL}${v}`),
                category: donnees.categorieNom,
                /* Sans `offers`, Google ne peut pas produire de resultat
                   enrichi produit : ni prix, ni disponibilite, ni devise.
                   `lowPrice` est le prix de depart reel — le fichier numerique
                   seul, dont le supplement vaut zero. `highPrice` est ce meme
                   portrait sur toile, le support le plus cher. La fourchette
                   decrit donc un portrait a une personne, options en sus :
                   annoncer un maximum tenant compte des dix personnages
                   possibles gonflerait le prix affiche en resultat de
                   recherche sans decrire ce que la plupart commandent. */
                offers: {
                  "@type": "AggregateOffer",
                  priceCurrency: "EUR",
                  lowPrice: prix.base,
                  highPrice: prix.base + prix.canvas,
                  offerCount: PRINT_KEYS.length,
                  availability: "https://schema.org/InStock",
                  url: `${SITE_URL}/${locale}/${slug}`,
                  seller: { "@type": "Organization", name: "Cartoonova" },
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: tNav("home"), item: `${SITE_URL}/${locale}` },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: donnees.categorieNom,
                    item: `${SITE_URL}/${locale}/collections#${p.categorie}`,
                  },
                  { "@type": "ListItem", position: 3, name: donnees.titre, item: `${SITE_URL}/${locale}/${slug}` },
                ],
              },
            ],
          }),
        }}
      />
      <FicheProduit donnees={donnees} />
    </>
  );
}
