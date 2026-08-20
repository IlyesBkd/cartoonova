import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";
import Catalogue, { type CarteCatalogue } from "@/components/pages/Catalogue";
import {
  CATALOGUE_EN_LIGNE,
  CATEGORIES,
  NOMS_CATEGORIE,
  SLUG_PHARE,
  descriptionProduit,
  titreProduit,
  universProduit,
  type Categorie,
} from "@/lib/catalogue";
import { visuelsProduit } from "@/lib/visuels";
import { getPricesForCurrency } from "@/lib/db";
import { DEFAULT_PRICE_SET } from "@/lib/types";
import { alternatesPour } from "@/lib/seo";

// Un seul univers est annonce best-seller sur le site. Le slug etait ecrit ici
// en dur ; il vient maintenant de `SLUG_PHARE`, l'unique endroit du code ou le
// produit phare est declare — voir lib/catalogue.ts.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: brut } = await params;
  const locale = brut as Locale;
  const t = await getTranslations({ locale, namespace: "tj" });

  const titre = `${t("catalogueTitre")} ${t("catalogueAccent")} — Cartoonova`;

  return {
    title: titre,
    description: t("catalogueSous"),
    alternates: alternatesPour(locale, "/collections"),
    openGraph: {
      title: titre,
      description: t("catalogueSous"),
      url: `${SITE_URL}/${locale}/collections`,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: brut } = await params;
  const locale = brut as Locale;

  const produits: CarteCatalogue[] = CATALOGUE_EN_LIGNE.map((p) => {
    const visuels = visuelsProduit(p.slug);
    return {
      slug: p.slug,
      univers: universProduit(p, locale),
      categorie: p.categorie,
      visuels: visuels.galerie.slice(0, 2),
      accroche: accrocheCourte(descriptionProduit(p, locale)),
      nbDecors: visuels.decors.length,
      vedette: p.slug === SLUG_PHARE,
    };
  });

  const nomsCategorie = Object.fromEntries(
    CATEGORIES.map((c) => [c, NOMS_CATEGORIE[c][locale]])
  ) as Record<Categorie, string>;

  let prixDepart = DEFAULT_PRICE_SET.base;
  try {
    prixDepart = (await getPricesForCurrency("EUR")).base;
  } catch {
    // Repli sur la grille par defaut si la base est injoignable.
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            numberOfItems: produits.length,
            itemListElement: CATALOGUE_EN_LIGNE.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: titreProduit(p, locale),
              url: `${SITE_URL}/${locale}/${p.slug}`,
            })),
          }),
        }}
      />
      <Catalogue
        produits={produits}
        nomsCategorie={nomsCategorie}
        prixDepart={prixDepart}
      />
    </>
  );
}

/** Premiere phrase de la description : la carte n'a la place que d'une ligne. */
function accrocheCourte(description: string): string {
  const fin = description.search(/[.!?]\s/);
  const phrase = fin > 0 ? description.slice(0, fin + 1) : description;
  return phrase.length > 96 ? `${phrase.slice(0, 93).trimEnd()}…` : phrase;
}
